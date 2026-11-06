import { Rol, esAdministrador, type Actor } from '../../../../shared/domain/actor.js';
import { ErrorDeValidacion, ErrorProhibido } from '../../../../shared/domain/errors.js';
import { esUuid, paginar, type Pagina } from '../../../../shared/application/paginacion.js';
import { ProductoNoEncontradoError } from '../../domain/errors.js';
import { cantidadEntera } from '../../domain/stock.js';
import type {
  ExistenciasProducto,
  InventarioRepository,
  ItemReserva,
  MovimientoInventario,
  PropiedadProductoPort,
  ResultadoReservar,
  TipoMovimientoManual,
} from '../ports/ports.js';

const TIPOS_MANUALES: readonly TipoMovimientoManual[] = ['INGRESO', 'DEVOLUCION', 'AJUSTE'];
const CLAVE = /^[A-Za-z0-9:_.-]{1,100}$/;
const MAX_ITEMS = 50;

type Propiedad = { productoId: string; puestoId: string; usuarioIdTitular: string };

/** Carga el producto y exige acceso: el titular (lectura y escritura) o, solo lectura, el administrador (R7). */
async function cargarConAcceso(productoId: unknown, actor: Actor, propiedad: PropiedadProductoPort, escritura: boolean): Promise<Propiedad> {
  if (actor.rol !== Rol.COMERCIANTE && !(esAdministrador(actor) && !escritura)) {
    throw new ErrorProhibido(escritura ? 'Solo el comerciante titular puede modificar el inventario.' : 'No tiene permiso para consultar el inventario.');
  }
  if (!esUuid(productoId)) throw new ProductoNoEncontradoError();
  const p = await propiedad.productoConTitular(productoId);
  if (!p) throw new ProductoNoEncontradoError();
  if (actor.rol === Rol.COMERCIANTE && p.usuarioIdTitular !== actor.id) {
    throw new ErrorProhibido('El producto pertenece a otro comerciante.');
  }
  return p;
}

const sinExistencias = (p: Propiedad): ExistenciasProducto => ({ productoId: p.productoId, puestoId: p.puestoId, stockFisico: 0, stockReservado: 0, stockDisponible: 0 });

/** RF12 · HU14: ingresos, devoluciones y ajustes (deltas atómicos). RF13: cada uno genera un movimiento. */
export class RegistrarMovimientoStock {
  constructor(private readonly inventario: InventarioRepository, private readonly propiedad: PropiedadProductoPort) {}

  async ejecutar(productoId: string, c: { tipo: unknown; cantidad: unknown; motivo?: unknown }, actor: Actor): Promise<ExistenciasProducto> {
    // Se autoriza primero (rol y propiedad) y después se valida la entrada.
    const p = await cargarConAcceso(productoId, actor, this.propiedad, true);
    if (typeof c.tipo !== 'string' || !TIPOS_MANUALES.includes(c.tipo as TipoMovimientoManual)) throw new ErrorDeValidacion('El tipo debe ser INGRESO, DEVOLUCION o AJUSTE.');
    const tipo = c.tipo as TipoMovimientoManual;
    const delta = cantidadEntera(c.cantidad, { permitirNegativa: tipo === 'AJUSTE' });
    let motivo: string | null = null;
    if (c.motivo !== undefined && c.motivo !== null) {
      if (typeof c.motivo !== 'string' || c.motivo.trim().length > 200) throw new ErrorDeValidacion('El motivo debe ser texto de hasta 200 caracteres.');
      motivo = c.motivo.trim() || null;
    }
    if (tipo === 'AJUSTE' && !motivo) throw new ErrorDeValidacion('Un ajuste requiere indicar el motivo.');
    return this.inventario.variarStock({ productoId: p.productoId, puestoId: p.puestoId, tipo, delta, motivo, actorId: actor.id });
  }
}

/** RF14 · HU14: stock físico, reservado y disponible de un producto (sin existencias registradas: ceros). */
export class ConsultarInventarioProducto {
  constructor(private readonly inventario: InventarioRepository, private readonly propiedad: PropiedadProductoPort) {}

  async ejecutar(productoId: string, actor: Actor): Promise<ExistenciasProducto> {
    const p = await cargarConAcceso(productoId, actor, this.propiedad, false);
    return (await this.inventario.obtener(p.productoId)) ?? sinExistencias(p);
  }
}

/** Comerciante: solo existencias de sus puestos. Administrador: todas (lectura). */
export class ListarInventario {
  constructor(private readonly inventario: InventarioRepository, private readonly propiedad: PropiedadProductoPort) {}

  async ejecutar(actor: Actor, f: { puestoId?: string; pagina?: number; limite?: number } = {}): Promise<Pagina<ExistenciasProducto>> {
    const { pagina, limite, desplazamiento } = paginar(f.pagina, f.limite, 100);
    if (f.puestoId !== undefined && !esUuid(f.puestoId)) throw new ErrorDeValidacion('El puesto no es válido.');
    let puestoIds: string[] | undefined;
    if (esAdministrador(actor)) {
      puestoIds = undefined;
    } else if (actor.rol === Rol.COMERCIANTE) {
      puestoIds = await this.propiedad.idsPuestoDeTitular(actor.id);
      if (f.puestoId && !puestoIds.includes(f.puestoId)) throw new ErrorProhibido('No puede consultar el inventario de otro comerciante.');
      if (puestoIds.length === 0) return { datos: [], pagina, limite, total: 0, totalPaginas: 0 };
    } else {
      throw new ErrorProhibido('No tiene permiso para consultar el inventario.');
    }
    const { items, total } = await this.inventario.listar({ puestoIds, puestoId: f.puestoId, limite, desplazamiento });
    return { datos: items, pagina, limite, total, totalPaginas: Math.ceil(total / limite) };
  }
}

/** RF13 · HU15: historial de movimientos del producto, el más reciente primero. */
export class ListarMovimientos {
  constructor(private readonly inventario: InventarioRepository, private readonly propiedad: PropiedadProductoPort) {}

  async ejecutar(productoId: string, actor: Actor, f: { pagina?: number; limite?: number } = {}): Promise<Pagina<MovimientoInventario>> {
    const p = await cargarConAcceso(productoId, actor, this.propiedad, false);
    const { pagina, limite, desplazamiento } = paginar(f.pagina, f.limite, 100);
    const { items, total } = await this.inventario.listarMovimientos(p.productoId, { limite, desplazamiento });
    return { datos: items, pagina, limite, total, totalPaginas: Math.ceil(total / limite) };
  }
}

// ───────────── API pública del módulo (la usan pedidos, pagos y catálogo; sin actor HTTP) ─────────────

/** Unidades disponibles de un producto (RF19). Sin existencias registradas: 0. */
export class ConsultarDisponibilidad {
  constructor(private readonly inventario: InventarioRepository) {}

  async ejecutar(productoId: string): Promise<number> {
    if (!esUuid(productoId)) throw new ErrorDeValidacion('El producto no es válido.');
    return (await this.inventario.obtener(productoId))?.stockDisponible ?? 0;
  }
}

function validarClave(clave: unknown): string {
  if (typeof clave !== 'string' || !CLAVE.test(clave)) throw new ErrorDeValidacion('La clave de operación no es válida (1–100 caracteres: letras, números y : _ . -).');
  return clave;
}

/** RF15 · RF25 · ADR-003: reserva atómica, todo-o-nada e idempotente por clave de operación. */
export class ReservarInventario {
  constructor(private readonly inventario: InventarioRepository, private readonly reloj: () => Date = () => new Date()) {}

  async ejecutar(c: { claveOperacion: unknown; items: unknown; expiraEn: unknown }): Promise<ResultadoReservar> {
    const claveOperacion = validarClave(c.claveOperacion);
    if (!Array.isArray(c.items) || c.items.length === 0 || c.items.length > MAX_ITEMS) throw new ErrorDeValidacion(`Debe indicar entre 1 y ${MAX_ITEMS} productos.`);
    const vistos = new Set<string>();
    const items: ItemReserva[] = c.items.map((i: { productoId?: unknown; cantidad?: unknown }) => {
      if (!esUuid(i?.productoId)) throw new ErrorDeValidacion('El producto no es válido.');
      if (vistos.has(i.productoId)) throw new ErrorDeValidacion('Un producto no puede repetirse en la misma reserva.');
      vistos.add(i.productoId);
      return { productoId: i.productoId, cantidad: cantidadEntera(i.cantidad) };
    });
    if (!(c.expiraEn instanceof Date) || Number.isNaN(c.expiraEn.getTime()) || c.expiraEn.getTime() <= this.reloj().getTime()) {
      throw new ErrorDeValidacion('El vencimiento de la reserva debe ser una fecha futura.');
    }
    // Se ordena por producto: todas las transacciones bloquean las filas en el mismo orden (sin interbloqueos).
    items.sort((a, b) => (a.productoId < b.productoId ? -1 : 1));
    return this.inventario.reservar({ claveOperacion, items, expiraEn: c.expiraEn });
  }
}

/** Libera una reserva (cancelación o expiración). Idempotente: la segunda llamada no vuelve a liberar. */
export class LiberarReserva {
  constructor(private readonly inventario: InventarioRepository) {}
  ejecutar(claveOperacion: unknown, motivo = 'CANCELACION') {
    return this.inventario.liberar({ claveOperacion: validarClave(claveOperacion), motivo });
  }
}

/** Registra la venta efectiva de lo reservado: baja físico y reservado sin descontar dos veces. Idempotente. */
export class ConfirmarVentaReservada {
  constructor(private readonly inventario: InventarioRepository) {}
  ejecutar(claveOperacion: unknown) {
    return this.inventario.confirmarVenta({ claveOperacion: validarClave(claveOperacion) });
  }
}

/** Libera las reservas vencidas (la invoca un proceso programado). Cada una es una transacción independiente. */
export class ExpirarReservasVencidas {
  constructor(private readonly inventario: InventarioRepository, private readonly reloj: () => Date = () => new Date()) {}

  async ejecutar(lote = 100): Promise<{ reservasLiberadas: number; unidades: number }> {
    const ahora = this.reloj();
    const claves = await this.inventario.clavesVencidas(ahora, lote);
    let unidades = 0;
    let reservasLiberadas = 0;
    for (const claveOperacion of claves) {
      const { liberadas } = await this.inventario.liberar({ claveOperacion, soloVencidasAl: ahora, motivo: 'EXPIRACION' });
      if (liberadas > 0) { reservasLiberadas++; unidades += liberadas; }
    }
    return { reservasLiberadas, unidades };
  }
}
