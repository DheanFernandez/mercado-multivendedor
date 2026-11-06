import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import {
  ClaveOperacionReutilizadaError,
  ReservaNoEncontradaError,
  ReservaYaConfirmadaError,
  ReservaYaLiberadaError,
  StockFisicoInsuficienteError,
  StockInsuficienteError,
} from '../domain/errors.js';
import type {
  EstadoReserva,
  ExistenciasProducto,
  InventarioRepository,
  ItemReserva,
  MovimientoInventario,
  ResultadoReservar,
  TipoMovimiento,
} from '../application/ports/ports.js';

type Tx = Prisma.TransactionClient;
type FilaStock = { stock_fisico: number; stock_reservado: number };

const EPOCH = new Date(0);
/** Esperar una conexión del pool ante ráfagas de solicitudes no debe fallar; la transacción en sí es de milisegundos. */
const OPCIONES_TX = { maxWait: 20_000, timeout: 15_000 } as const;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Interbloqueo o fallo de serialización: PostgreSQL ya revirtió la transacción y es seguro reintentarla (ADR-003 §5.6). */
const esReintentable = (e: unknown) => /deadlock|could not serialize|40P01|40001|P2034/i.test(`${(e as { code?: string })?.code ?? ''} ${(e as Error)?.message ?? ''} ${JSON.stringify((e as { meta?: unknown })?.meta ?? '')}`);

const vista = (productoId: string, puestoId: string, f: { stockFisico: number; stockReservado: number }): ExistenciasProducto => ({
  productoId, puestoId, stockFisico: f.stockFisico, stockReservado: f.stockReservado, stockDisponible: f.stockFisico - f.stockReservado,
});

/**
 * Inventario sobre PostgreSQL. Cada operación es UNA transacción corta. La comprobación y la actualización de
 * disponibilidad se hacen en la MISMA sentencia (UPDATE condicional), de modo que dos solicitudes simultáneas
 * nunca ven la misma disponibilidad (ADR-003 §6.3). Los CHECK de la tabla son la última barrera.
 */
@Injectable()
export class PrismaInventarioRepository implements InventarioRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async conReintento<T>(op: () => Promise<T>): Promise<T> {
    for (let intento = 0; ; intento++) {
      try {
        return await op();
      } catch (e) {
        if (intento >= 4 || !esReintentable(e)) throw e;
        await esperar(10 * (intento + 1));
      }
    }
  }

  private movimiento(
    tx: Tx,
    m: { inventarioId: string; tipo: TipoMovimiento; vf: number; vr: number; despues: FilaStock; motivo?: string | null; actorId?: string | null; referencia?: string | null },
  ) {
    return tx.$executeRaw`INSERT INTO movimientos_inventario
      (id, inventario_id, tipo, variacion_fisica, variacion_reservada, stock_fisico_despues, stock_reservado_despues, motivo, actor_id, referencia)
      VALUES (gen_random_uuid(), ${m.inventarioId}::uuid, ${m.tipo}::"TipoMovimientoInventario", ${m.vf}::int, ${m.vr}::int,
              ${m.despues.stock_fisico}::int, ${m.despues.stock_reservado}::int, ${m.motivo ?? null}::text, ${m.actorId ?? null}::uuid, ${m.referencia ?? null}::text)`;
  }

  // ───────────── lecturas ─────────────

  async obtener(productoId: string) {
    const f = await this.prisma.inventario.findUnique({ where: { productoId } });
    return f ? vista(f.productoId, f.puestoId, f) : null;
  }

  async listar(q: { puestoIds?: string[]; puestoId?: string; limite: number; desplazamiento: number }) {
    // El caso de uso ya verificó que `puestoId`, si viene, pertenece a `puestoIds`.
    const where: Prisma.InventarioWhereInput = { puestoId: q.puestoId ?? (q.puestoIds ? { in: q.puestoIds } : undefined) };
    const [filas, total] = await Promise.all([
      this.prisma.inventario.findMany({ where, orderBy: [{ actualizadoEn: 'desc' }, { id: 'asc' }], skip: q.desplazamiento, take: q.limite }),
      this.prisma.inventario.count({ where }),
    ]);
    return { items: filas.map((f) => vista(f.productoId, f.puestoId, f)), total };
  }

  async listarMovimientos(productoId: string, q: { limite: number; desplazamiento: number }) {
    const where = { inventario: { productoId } };
    const [filas, total] = await Promise.all([
      this.prisma.movimientoInventario.findMany({ where, orderBy: [{ creadoEn: 'desc' }, { id: 'asc' }], skip: q.desplazamiento, take: q.limite }),
      this.prisma.movimientoInventario.count({ where }),
    ]);
    const items: MovimientoInventario[] = filas.map((m) => ({
      id: m.id, tipo: m.tipo, variacionFisica: m.variacionFisica, variacionReservada: m.variacionReservada,
      stockFisicoDespues: m.stockFisicoDespues, stockReservadoDespues: m.stockReservadoDespues,
      motivo: m.motivo, actorId: m.actorId, referencia: m.referencia, creadoEn: m.creadoEn,
    }));
    return { items, total };
  }

  async clavesVencidas(ahora: Date, lote: number) {
    const filas = await this.prisma.$queryRaw<{ clave_operacion: string }[]>`
      SELECT DISTINCT clave_operacion FROM reservas_inventario
      WHERE estado = 'RESERVADA' AND expira_en <= ${ahora.toISOString()}::timestamptz LIMIT ${lote}::int`;
    return filas.map((f) => f.clave_operacion);
  }

  // ───────────── escrituras atómicas ─────────────

  variarStock(c: { productoId: string; puestoId: string; tipo: 'INGRESO' | 'DEVOLUCION' | 'AJUSTE'; delta: number; motivo: string | null; actorId: string }) {
    return this.conReintento(() =>
      this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`INSERT INTO inventarios (id, producto_id, puesto_id, stock_fisico, stock_reservado)
          VALUES (gen_random_uuid(), ${c.productoId}::uuid, ${c.puestoId}::uuid, 0, 0) ON CONFLICT DO NOTHING`; // sin objetivo: cubre ambos indices unicos (producto) y (producto, puesto) ante creaciones simultaneas
        // El delta se suma en la propia sentencia: dos actualizaciones simultáneas nunca se pisan.
        const filas = await tx.$queryRaw<(FilaStock & { id: string })[]>`
          UPDATE inventarios SET stock_fisico = stock_fisico + ${c.delta}::int, actualizado_en = now()
          WHERE producto_id = ${c.productoId}::uuid AND stock_fisico + ${c.delta}::int >= stock_reservado
          RETURNING id, stock_fisico, stock_reservado`;
        if (filas.length === 0) throw new StockFisicoInsuficienteError();
        const f = filas[0]!;
        await this.movimiento(tx, { inventarioId: f.id, tipo: c.tipo, vf: c.delta, vr: 0, despues: f, motivo: c.motivo, actorId: c.actorId });
        return vista(c.productoId, c.puestoId, { stockFisico: f.stock_fisico, stockReservado: f.stock_reservado });
      }, OPCIONES_TX),
    );
  }

  reservar(c: { claveOperacion: string; items: ItemReserva[]; expiraEn: Date }): Promise<ResultadoReservar> {
    return this.conReintento(() =>
      this.prisma.$transaction(async (tx) => {
        const existentes = async () =>
          tx.$queryRaw<{ producto_id: string; cantidad: number; estado: EstadoReserva }[]>`
            SELECT i.producto_id, r.cantidad, r.estado::text AS estado
            FROM reservas_inventario r JOIN inventarios i ON i.id = r.inventario_id
            WHERE r.clave_operacion = ${c.claveOperacion}`;
        const mismaSolicitud = (prev: { producto_id: string; cantidad: number }[]) =>
          prev.length === c.items.length && c.items.every((i) => prev.some((r) => r.producto_id === i.productoId && r.cantidad === i.cantidad));
        const resultadoPrevio = (prev: { producto_id: string; cantidad: number; estado: EstadoReserva }[]): ResultadoReservar => {
          if (!mismaSolicitud(prev)) throw new ClaveOperacionReutilizadaError();
          return { reservas: prev.map((r) => ({ productoId: r.producto_id, cantidad: r.cantidad, estado: r.estado })), repetida: true };
        };

        // Reintento de una operación ya procesada: se devuelve el resultado anterior, sin tocar el stock.
        const previas = await existentes();
        if (previas.length > 0) return resultadoPrevio(previas);

        const ids = c.items.map((i) => i.productoId);
        const invs = await tx.$queryRaw<{ id: string; producto_id: string }[]>`SELECT id, producto_id FROM inventarios WHERE producto_id = ANY(${ids}::uuid[])`;
        const invDe = new Map(invs.map((i) => [i.producto_id, i.id]));
        const faltante = c.items.find((i) => !invDe.has(i.productoId));
        if (faltante) throw new StockInsuficienteError(faltante.productoId); // sin existencias registradas = 0 disponibles

        // Orden estable por inventario: todas las transacciones bloquean filas en el mismo orden (sin interbloqueos).
        const orden = [...c.items].sort((a, b) => (invDe.get(a.productoId)! < invDe.get(b.productoId)! ? -1 : 1));
        let nuevas = 0;
        for (const item of orden) {
          const invId = invDe.get(item.productoId)!;
          const ins = await tx.$queryRaw<{ id: string }[]>`
            INSERT INTO reservas_inventario (id, clave_operacion, inventario_id, cantidad, estado, expira_en)
            VALUES (gen_random_uuid(), ${c.claveOperacion}, ${invId}::uuid, ${item.cantidad}::int, 'RESERVADA', ${c.expiraEn.toISOString()}::timestamptz)
            ON CONFLICT (clave_operacion, inventario_id) DO NOTHING RETURNING id`;
          if (ins.length === 0) continue; // otra transacción con la misma clave ya la confirmó (reintento simultáneo)
          nuevas++;
          // Comprobación y actualización en una sola sentencia: sin filas ⇒ no hay stock disponible ⇒ se revierte todo.
          const upd = await tx.$queryRaw<FilaStock[]>`
            UPDATE inventarios SET stock_reservado = stock_reservado + ${item.cantidad}::int, actualizado_en = now()
            WHERE id = ${invId}::uuid AND stock_fisico - stock_reservado >= ${item.cantidad}::int
            RETURNING stock_fisico, stock_reservado`;
          if (upd.length === 0) throw new StockInsuficienteError(item.productoId);
          await this.movimiento(tx, { inventarioId: invId, tipo: 'RESERVA', vf: 0, vr: item.cantidad, despues: upd[0]!, referencia: c.claveOperacion });
        }
        if (nuevas === 0) return resultadoPrevio(await existentes());
        if (nuevas !== c.items.length) throw new ClaveOperacionReutilizadaError();
        return { reservas: c.items.map((i) => ({ ...i, estado: 'RESERVADA' as const })), repetida: false };
      }, OPCIONES_TX),
    );
  }

  liberar(c: { claveOperacion: string; soloVencidasAl?: Date; motivo: string }) {
    return this.conReintento(() =>
      this.prisma.$transaction(async (tx) => {
        // Cambiar el estado es lo que hace idempotente la operación: solo quien lo cambia toca el stock.
        const cambiadas = await tx.$queryRaw<{ inventario_id: string; cantidad: number }[]>`
          UPDATE reservas_inventario SET estado = 'LIBERADA', actualizado_en = now()
          WHERE clave_operacion = ${c.claveOperacion} AND estado = 'RESERVADA'
            AND (${c.soloVencidasAl !== undefined}::boolean = false OR expira_en <= ${(c.soloVencidasAl ?? EPOCH).toISOString()}::timestamptz)
          RETURNING inventario_id, cantidad`;
        if (cambiadas.length === 0) {
          if (c.soloVencidasAl) return { liberadas: 0 };
          const estados = await tx.$queryRaw<{ estado: EstadoReserva }[]>`SELECT estado::text AS estado FROM reservas_inventario WHERE clave_operacion = ${c.claveOperacion}`;
          if (estados.length === 0) throw new ReservaNoEncontradaError();
          if (estados.some((e) => e.estado === 'CONFIRMADA')) throw new ReservaYaConfirmadaError();
          return { liberadas: 0 };
        }
        let liberadas = 0;
        for (const r of [...cambiadas].sort((a, b) => (a.inventario_id < b.inventario_id ? -1 : 1))) {
          const upd = await tx.$queryRaw<FilaStock[]>`
            UPDATE inventarios SET stock_reservado = stock_reservado - ${r.cantidad}::int, actualizado_en = now()
            WHERE id = ${r.inventario_id}::uuid AND stock_reservado >= ${r.cantidad}::int RETURNING stock_fisico, stock_reservado`;
          if (upd.length === 0) throw new Error('Invariante de inventario violada al liberar una reserva.');
          await this.movimiento(tx, { inventarioId: r.inventario_id, tipo: 'LIBERACION', vf: 0, vr: -r.cantidad, despues: upd[0]!, motivo: c.motivo, referencia: c.claveOperacion });
          liberadas += r.cantidad;
        }
        return { liberadas };
      }, OPCIONES_TX),
    );
  }

  confirmarVenta(c: { claveOperacion: string }) {
    return this.conReintento(() =>
      this.prisma.$transaction(async (tx) => {
        const cambiadas = await tx.$queryRaw<{ inventario_id: string; cantidad: number }[]>`
          UPDATE reservas_inventario SET estado = 'CONFIRMADA', actualizado_en = now()
          WHERE clave_operacion = ${c.claveOperacion} AND estado = 'RESERVADA' RETURNING inventario_id, cantidad`;
        if (cambiadas.length === 0) {
          const estados = await tx.$queryRaw<{ estado: EstadoReserva }[]>`SELECT estado::text AS estado FROM reservas_inventario WHERE clave_operacion = ${c.claveOperacion}`;
          if (estados.length === 0) throw new ReservaNoEncontradaError();
          if (estados.some((e) => e.estado === 'LIBERADA')) throw new ReservaYaLiberadaError();
          return { confirmadas: 0 }; // ya confirmada antes: no se descuenta dos veces
        }
        let confirmadas = 0;
        for (const r of [...cambiadas].sort((a, b) => (a.inventario_id < b.inventario_id ? -1 : 1))) {
          const upd = await tx.$queryRaw<FilaStock[]>`
            UPDATE inventarios SET stock_fisico = stock_fisico - ${r.cantidad}::int, stock_reservado = stock_reservado - ${r.cantidad}::int, actualizado_en = now()
            WHERE id = ${r.inventario_id}::uuid AND stock_reservado >= ${r.cantidad}::int RETURNING stock_fisico, stock_reservado`;
          if (upd.length === 0) throw new Error('Invariante de inventario violada al confirmar una venta.');
          await this.movimiento(tx, { inventarioId: r.inventario_id, tipo: 'VENTA', vf: -r.cantidad, vr: -r.cantidad, despues: upd[0]!, referencia: c.claveOperacion });
          confirmadas += r.cantidad;
        }
        return { confirmadas };
      }, OPCIONES_TX),
    );
  }
}
