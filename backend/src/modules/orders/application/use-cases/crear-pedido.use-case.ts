import { randomUUID } from 'node:crypto';
import { Rol, type Actor } from '../../../../shared/domain/actor.js';
import { ErrorDeValidacion, ErrorProhibido } from '../../../../shared/domain/errors.js';
import { CarritoVacioError, LineasNoVigentesError } from '../../domain/errors.js';
import { huellaCarrito } from '../../domain/huella-carrito.js';
import { Pedido, type LineaNueva } from '../../domain/pedido.entity.js';
import type { CarritoPort, LineaParaPedido } from '../ports/carrito.port.js';
import { ConfiguracionReservaNoDisponibleError, MAX_DURACION_RESERVA_MINUTOS, type ConfiguracionReservaPort } from '../ports/configuracion-reserva.port.js';
import type { PedidoRepository } from '../ports/pedido.repository.js';
import type { RelojPort } from '../ports/reloj.port.js';
import type { ReservaInventarioPort } from '../ports/reserva-inventario.port.js';
import type { UnidadDeTrabajo } from '../ports/unidad-de-trabajo.port.js';

export interface DependenciasCrearPedido {
  uow: UnidadDeTrabajo;
  pedidos: PedidoRepository;
  carrito: CarritoPort;
  inventario: ReservaInventarioPort;
  configuracion: ConfiguracionReservaPort;
  reloj: RelojPort;
}

export interface ResultadoCrearPedido {
  pedido: Pedido;
  /** true: creado ahora (201); false: repetición de la clave (200). */
  creado: boolean;
}

/** Mismo formato que la restricción de la base (data-model §2). */
const CLAVE = /^[A-Za-z0-9:_.-]{1,100}$/;
const MS_POR_MINUTO = 60_000;

function exigirCliente(actor: Actor): string {
  if (actor.rol !== Rol.CLIENTE) throw new ErrorProhibido('Solo los clientes pueden crear pedidos.');
  return actor.id;
}
function exigirClave(valor: unknown): string {
  if (typeof valor !== 'string' || !CLAVE.test(valor)) {
    throw new ErrorDeValidacion('La clave de operación es obligatoria: de 1 a 100 caracteres A-Z, a-z, 0-9, «:», «_», «.» o «-».');
  }
  return valor;
}
/** Sin valor predeterminado: falta o es inválida ⇒ 503 (FR-028). Se lee en cada creación. */
function duracionMinutos(configuracion: ConfiguracionReservaPort): number {
  const m = configuracion.duracionMinutos();
  if (typeof m !== 'number' || !Number.isInteger(m) || m < 1 || m > MAX_DURACION_RESERVA_MINUTOS) throw new ConfiguracionReservaNoDisponibleError();
  return m;
}
const aLineaNueva = (l: LineaParaPedido): LineaNueva => ({
  productoId: l.productoId,
  puesto: l.puesto!,
  nombre: l.nombre!,
  unidadVenta: l.unidadVenta!,
  presentacion: l.presentacion,
  cantidad: l.cantidad,
  precioUnitarioCentimos: l.precioUnitarioCentimos!,
});

/**
 * HU07 · RF25–RF29: convierte el carrito del cliente en un pedido con un subpedido por puesto y reserva su stock,
 * todo en UNA unidad de trabajo (plan §«Flujo y transacción»). La unidad reintenta el bloque completo ante errores
 * transitorios; los errores de dominio la revierten sin reintento. Idempotente por (cliente, clave).
 */
export class CrearPedido {
  constructor(private readonly d: DependenciasCrearPedido) {}

  async ejecutar(actor: Actor, cmd: { claveIdempotencia?: unknown }): Promise<ResultadoCrearPedido> {
    // 0 · fuera de la transacción: rol y clave
    const clienteId = exigirCliente(actor);
    const clave = exigirClave(cmd.claveIdempotencia);

    // 1 · repetición rápida (no lee el carrito). Una operación ya confirmada se recupera aunque la configuración de
    //     reservas no esté disponible: no va a reservar nada (DI-2).
    const previo = await this.d.pedidos.buscarPorClave(clienteId, clave);
    if (previo) return { pedido: previo, creado: false };

    // 1b · solo para una creación nueva: duración de la reserva (falta o inválida ⇒ 503)
    const minutos = duracionMinutos(this.d.configuracion);

    // 2 · unidad de trabajo
    return this.d.uow.ejecutar(async () => {
      await this.d.pedidos.bloquearCliente(clienteId); // a · serializa las creaciones del cliente
      const repetido = await this.d.pedidos.buscarPorClave(clienteId, clave); // b · repetición confirmada mientras esperaba
      if (repetido) return { pedido: repetido, creado: false };

      const carrito = await this.d.carrito.obtenerParaPedido(clienteId); // c · lectura AUTORITATIVA (bloqueada)
      if (carrito.carritoId === null || carrito.lineas.length === 0) throw new CarritoVacioError();
      const noVigentes = carrito.lineas.filter((l) => !l.comprable).map((l) => l.productoId);
      if (noVigentes.length > 0) throw new LineasNoVigentesError(noVigentes); // el puerto ya entrega el orden por producto

      const ahora = this.d.reloj.ahora(); // d · dominio puro
      const nuevo = Pedido.crear({
        id: randomUUID(),
        clienteId,
        claveIdempotencia: clave,
        carritoId: carrito.carritoId,
        huellaCarrito: huellaCarrito(carrito.lineas),
        lineas: carrito.lineas.map(aLineaNueva),
        reservaVenceEn: new Date(ahora.getTime() + minutos * MS_POR_MINUTO),
        creadoEn: ahora,
        generarId: randomUUID,
      });

      const pedido = await this.d.pedidos.insertar(nuevo); // e · asigna el código (colisiones resueltas dentro)
      await this.d.pedidos.guardarDetalle(pedido);
      await this.d.carrito.vaciar(clienteId); // f · el carrito ya está bloqueado
      await this.d.inventario.reservar({
        // g · ÚLTIMA operación: todos los productos en una llamada, ordenados; sin stock ⇒ ROLLBACK de todo
        claveOperacion: `pedido:${pedido.id}`,
        items: pedido.subpedidos
          .flatMap((s) => s.lineas)
          .map((l) => ({ productoId: l.productoId, cantidad: l.cantidad }))
          .sort((a, b) => (a.productoId < b.productoId ? -1 : 1)),
        expiraEn: pedido.reservaVenceEn,
      });
      return { pedido, creado: true };
    });
  }
}
