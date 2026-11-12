import { Inject, Injectable } from '@nestjs/common';
import type { EstadoPedidoPuesto, Prisma, UnidadVenta } from '../../../generated/prisma/client.js';
import { esUuid } from '../../../shared/application/paginacion.js';
import { UnidadDeTrabajoRequeridaError } from '../../../shared/domain/unidad-de-trabajo.error.js';
import { type ClienteTransaccional, transaccionVigente } from '../../../shared/infrastructure/prisma/contexto-transaccional.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { db } from '../../../shared/infrastructure/prisma/unidad-de-trabajo.js';
import { GENERADOR_CODIGO_PORT, type GeneradorCodigoPort } from '../application/ports/generador-codigo.port.js';
import {
  ClaveIdempotenciaEnUsoError,
  CodigoPedidoNoGenerableError,
  MAX_INTENTOS_CODIGO,
  type EntradaHistorialPedido,
  type Paginacion,
  type PedidoRepository,
  type ResumenPedido,
} from '../application/ports/pedido.repository.js';
import { estadoGeneral } from '../domain/estado-general.js';
import { Pedido } from '../domain/pedido.entity.js';
import { centimosDesdeDecimal, decimalDesdeCentimos } from './importes.js';

/** Prefijo de la clave del bloqueo consultivo por cliente (research D3). */
const PREFIJO_BLOQUEO = 'pedidos:crear:';
/** Restricción única (cliente, clave): su violación NO es una colisión de código. */
const UNICO_CLIENTE_CLAVE = 'pedidos_cliente_id_clave_idempotencia_key';

const INCLUIR = {
  subpedidos: { include: { lineas: true, historial: { orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }] } } },
} satisfies Prisma.PedidoInclude;
type FilaPedido = Prisma.PedidoGetPayload<{ include: typeof INCLUIR }>;

/** ¿Es la violación de la restricción única (cliente, clave)? Se busca en la causa del adaptador (23505 + índice). */
function esConflictoDeClave(error: unknown, profundidad = 0): boolean {
  if (error === null || typeof error !== 'object' || profundidad > 6) return false;
  const o = error as Record<string, unknown>;
  if (o['originalCode'] === '23505' && JSON.stringify(o['constraint'] ?? null).includes(UNICO_CLIENTE_CLAVE)) return true;
  return Object.values(o).some((v) => esConflictoDeClave(v, profundidad + 1)) || esConflictoDeClave((error as { cause?: unknown }).cause, profundidad + 1);
}

function aPedido(f: FilaPedido): Pedido {
  return Pedido.reconstituir({
    id: f.id,
    codigo: f.codigo,
    clienteId: f.clienteId,
    claveIdempotencia: f.claveIdempotencia,
    carritoId: f.carritoId,
    huellaCarrito: f.huellaCarrito,
    totalCentimos: centimosDesdeDecimal(f.total),
    reservaVenceEn: f.reservaVenceEn,
    creadoEn: f.creadoEn,
    subpedidos: f.subpedidos.map((s) => ({
      id: s.id,
      puestoId: s.puestoId,
      puesto: { codigo: s.puestoCodigo, nombre: s.puestoNombre },
      estado: s.estado,
      subtotalCentimos: centimosDesdeDecimal(s.subtotal),
      lineas: s.lineas.map((l) => ({
        id: l.id,
        productoId: l.productoId,
        nombre: l.nombreProducto,
        unidadVenta: l.unidadVenta,
        presentacion: l.presentacion,
        cantidad: l.cantidad,
        precioUnitarioCentimos: centimosDesdeDecimal(l.precioUnitario),
        subtotalCentimos: centimosDesdeDecimal(l.subtotal),
      })),
      historial: s.historial.map((h) => ({ estadoAnterior: h.estadoAnterior, estadoNuevo: h.estadoNuevo, origen: h.origen, actorId: h.actorId, creadoEn: h.creadoEn })),
    })),
  });
}

/**
 * Pedidos sobre PostgreSQL (T012). Toda sentencia usa la transacción de la unidad de trabajo vigente (`db()`), de modo
 * que el pedido, el carrito y la reserva se confirman o revierten juntos. El bloqueo y las escrituras SOLO existen dentro
 * de una unidad. Importes: NUMERIC ⇄ céntimos enteros sin coma flotante; lo leído se valida al reconstituir el agregado.
 */
@Injectable()
export class PrismaPedidoRepository implements PedidoRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GENERADOR_CODIGO_PORT) private readonly generador: GeneradorCodigoPort,
  ) {}

  private unidad(operacion: string): ClienteTransaccional {
    const tx = transaccionVigente();
    if (!tx) throw new UnidadDeTrabajoRequeridaError(operacion);
    return tx;
  }

  /** Bloqueo consultivo transaccional por cliente: se libera solo al terminar la transacción. `$executeRaw`: la función devuelve `void`. */
  async bloquearCliente(clienteId: string): Promise<void> {
    const tx = this.unidad('bloquearCliente');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${PREFIJO_BLOQUEO + clienteId}, 0))`;
  }

  async buscarPorClave(clienteId: string, clave: string): Promise<Pedido | null> {
    if (!esUuid(clienteId)) return null;
    const f = await db(this.prisma).pedido.findUnique({ where: { clienteId_claveIdempotencia: { clienteId, claveIdempotencia: clave } }, include: INCLUIR });
    return f ? aPedido(f) : null;
  }

  /**
   * Inserta la raíz con un código nuevo. `ON CONFLICT (codigo) DO NOTHING` resuelve la colisión SIN abortar la transacción
   * y se prueba otro código (≤ 5). La violación de (cliente, clave) no se trata como colisión: se traduce y se propaga.
   */
  async insertar(pedido: Pedido): Promise<Pedido> {
    const tx = this.unidad('insertar');
    const total = decimalDesdeCentimos(pedido.totalCentimos);
    for (let i = 0; i < MAX_INTENTOS_CODIGO; i++) {
      const conCodigo = pedido.conCodigo(this.generador.generar()); // valida el formato ANTES de escribir
      let filas: { id: string }[];
      try {
        filas = await tx.$queryRaw<{ id: string }[]>`
          INSERT INTO pedidos (id, codigo, cliente_id, clave_idempotencia, carrito_id, huella_carrito, total, reserva_vence_en, creado_en)
          VALUES (${pedido.id}::uuid, ${conCodigo.codigo}, ${pedido.clienteId}::uuid, ${pedido.claveIdempotencia}, ${pedido.carritoId}::uuid,
                  ${pedido.huellaCarrito}, ${total}::numeric, ${pedido.reservaVenceEn.toISOString()}::timestamptz, ${pedido.creadoEn.toISOString()}::timestamptz)
          ON CONFLICT (codigo) DO NOTHING
          RETURNING id`;
      } catch (e) {
        if (esConflictoDeClave(e)) throw new ClaveIdempotenciaEnUsoError({ cause: e });
        throw e; // cualquier otro fallo se propaga tal cual
      }
      if (filas.length === 1) return conCodigo;
    }
    throw new CodigoPedidoNoGenerableError();
  }

  /** Subpedidos, líneas e historial inicial en bloque (una sentencia por tabla) en la misma transacción. */
  async guardarDetalle(pedido: Pedido): Promise<void> {
    const tx = this.unidad('guardarDetalle');
    if (pedido.codigo === null) throw new Error('guardarDetalle exige un pedido ya insertado (con código).');
    await tx.subpedido.createMany({
      data: pedido.subpedidos.map((s) => ({
        id: s.id,
        pedidoId: pedido.id,
        puestoId: s.puestoId,
        puestoCodigo: s.puesto.codigo,
        puestoNombre: s.puesto.nombre,
        estado: s.estado as EstadoPedidoPuesto,
        subtotal: decimalDesdeCentimos(s.subtotalCentimos),
        creadoEn: pedido.creadoEn,
        actualizadoEn: pedido.creadoEn,
      })),
    });
    await tx.lineaPedido.createMany({
      data: pedido.subpedidos.flatMap((s) =>
        s.lineas.map((l) => ({
          id: l.id,
          subpedidoId: s.id,
          puestoId: s.puestoId,
          productoId: l.productoId,
          nombreProducto: l.nombre,
          unidadVenta: l.unidadVenta as UnidadVenta,
          presentacion: l.presentacion,
          cantidad: l.cantidad,
          precioUnitario: decimalDesdeCentimos(l.precioUnitarioCentimos),
          subtotal: decimalDesdeCentimos(l.subtotalCentimos),
        })),
      ),
    });
    await tx.historialEstadoSubpedido.createMany({
      data: pedido.subpedidos.flatMap((s) =>
        s.historial.map((h) => ({
          subpedidoId: s.id,
          estadoAnterior: h.estadoAnterior as EstadoPedidoPuesto | null,
          estadoNuevo: h.estadoNuevo as EstadoPedidoPuesto,
          origen: h.origen,
          actorId: h.actorId,
          creadoEn: h.creadoEn,
        })),
      ),
    });
  }

  async buscarPorId(clienteId: string, id: string): Promise<Pedido | null> {
    if (!esUuid(clienteId) || !esUuid(id)) return null;
    const f = await db(this.prisma).pedido.findFirst({ where: { id, clienteId }, include: INCLUIR });
    return f ? aPedido(f) : null;
  }

  async listar(clienteId: string, f: Paginacion): Promise<{ items: ResumenPedido[]; total: number }> {
    if (!esUuid(clienteId)) return { items: [], total: 0 };
    const c = db(this.prisma);
    const filas = await c.pedido.findMany({
      where: { clienteId },
      orderBy: [{ creadoEn: 'desc' }, { id: 'asc' }],
      skip: f.desplazamiento,
      take: f.limite,
      select: { id: true, codigo: true, creadoEn: true, total: true, subpedidos: { select: { estado: true } } },
    });
    const total = await c.pedido.count({ where: { clienteId } });
    return {
      items: filas.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        creadoEn: p.creadoEn,
        estadoGeneral: estadoGeneral(p.subpedidos.map((s) => s.estado)),
        totalCentimos: centimosDesdeDecimal(p.total),
        cantidadSubpedidos: p.subpedidos.length,
      })),
      total,
    };
  }

  async historial(clienteId: string, id: string, f: Paginacion): Promise<{ items: EntradaHistorialPedido[]; total: number } | null> {
    if (!esUuid(clienteId) || !esUuid(id)) return null;
    const c = db(this.prisma);
    const propio = await c.pedido.findFirst({ where: { id, clienteId }, select: { id: true } });
    if (!propio) return null;
    const donde = { subpedido: { pedidoId: id } };
    const filas = await c.historialEstadoSubpedido.findMany({
      where: donde,
      orderBy: [{ creadoEn: 'asc' }, { subpedido: { puestoId: 'asc' } }, { id: 'asc' }],
      skip: f.desplazamiento,
      take: f.limite,
      include: { subpedido: { select: { puestoCodigo: true, puestoNombre: true } } },
    });
    const total = await c.historialEstadoSubpedido.count({ where: donde });
    return {
      items: filas.map((h) => ({
        subpedidoId: h.subpedidoId,
        puesto: { codigo: h.subpedido.puestoCodigo, nombre: h.subpedido.puestoNombre },
        estadoAnterior: h.estadoAnterior,
        estadoNuevo: h.estadoNuevo,
        origen: h.origen,
        creadoEn: h.creadoEn,
      })),
      total,
    };
  }
}
