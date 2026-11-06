import type { Stock } from '../../domain/stock.js';

export type TipoMovimientoManual = 'INGRESO' | 'DEVOLUCION' | 'AJUSTE';
export type TipoMovimiento = TipoMovimientoManual | 'VENTA' | 'RESERVA' | 'LIBERACION';
export type EstadoReserva = 'RESERVADA' | 'LIBERADA' | 'CONFIRMADA';

export interface ExistenciasProducto {
  productoId: string;
  puestoId: string;
  stockFisico: number;
  stockReservado: number;
  stockDisponible: number;
}

export interface MovimientoInventario {
  id: string;
  tipo: TipoMovimiento;
  variacionFisica: number;
  variacionReservada: number;
  stockFisicoDespues: number;
  stockReservadoDespues: number;
  motivo: string | null;
  actorId: string | null;
  referencia: string | null;
  creadoEn: Date;
}

export interface ItemReserva {
  productoId: string;
  cantidad: number;
}
export interface ReservaResultado extends ItemReserva {
  estado: EstadoReserva;
}
export interface ResultadoReservar {
  reservas: ReservaResultado[];
  /** true si la clave ya existía: se devolvió el resultado anterior sin tocar el stock. */
  repetida: boolean;
}

/**
 * Persistencia del inventario. Cada método es UNA transacción corta y atómica (ADR-003); ninguno devuelve datos
 * que haya que revalidar fuera de la transacción.
 */
export interface InventarioRepository {
  obtener(productoId: string): Promise<ExistenciasProducto | null>;
  listar(f: { puestoIds?: string[]; puestoId?: string; limite: number; desplazamiento: number }): Promise<{ items: ExistenciasProducto[]; total: number }>;
  listarMovimientos(productoId: string, f: { limite: number; desplazamiento: number }): Promise<{ items: MovimientoInventario[]; total: number }>;
  /** Crea la fila de existencias si falta y aplica el delta al stock físico (condicionado a físico+delta ≥ reservado). */
  variarStock(c: { productoId: string; puestoId: string; tipo: TipoMovimientoManual; delta: number; motivo: string | null; actorId: string }): Promise<ExistenciasProducto>;
  /** Todo‑o‑nada e idempotente por (claveOperacion, producto). @throws StockInsuficienteError | ClaveOperacionReutilizadaError */
  reservar(c: { claveOperacion: string; items: ItemReserva[]; expiraEn: Date }): Promise<ResultadoReservar>;
  /** Idempotente. Con `soloVencidasAl` solo libera reservas vencidas a esa fecha. Devuelve las unidades liberadas por esta llamada. */
  liberar(c: { claveOperacion: string; soloVencidasAl?: Date; motivo: string }): Promise<{ liberadas: number }>;
  /** Convierte la reserva en venta (físico y reservado bajan a la vez). Idempotente. */
  confirmarVenta(c: { claveOperacion: string }): Promise<{ confirmadas: number }>;
  clavesVencidas(ahora: Date, lote: number): Promise<string[]>;
}

/** Puerto hacia Productos y Comerciantes: a qué puesto pertenece un producto y quién es el titular. */
export interface PropiedadProductoPort {
  productoConTitular(productoId: string): Promise<{ productoId: string; puestoId: string; usuarioIdTitular: string } | null>;
  idsPuestoDeTitular(usuarioId: string): Promise<string[]>;
}

export const toExistencias = (productoId: string, puestoId: string, s: Stock): ExistenciasProducto => ({
  productoId, puestoId, stockFisico: s.fisico, stockReservado: s.reservado, stockDisponible: s.disponible,
});

export const INVENTARIO_REPOSITORY = Symbol('INVENTARIO_REPOSITORY');
export const PROPIEDAD_PRODUCTO_PORT = Symbol('PROPIEDAD_PRODUCTO_PORT');
