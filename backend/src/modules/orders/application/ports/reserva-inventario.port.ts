import { ErrorDeConflicto } from '../../../../shared/domain/errors.js';

/** Falta de stock de un producto del pedido (409). El adaptador traduce el error de Inventario a este. */
export class StockInsuficientePedidoError extends ErrorDeConflicto {
  constructor(readonly productoId: string) {
    super('No hay stock suficiente para uno de los productos del pedido.');
  }
}

/**
 * Puerto hacia Inventario (contracts §4). UNA llamada con todos los productos: reserva todo o nada.
 * Dentro de una unidad vigente comparte su transacción (la reversión es el ROLLBACK, no una compensación).
 */
export interface ReservaInventarioPort {
  reservar(c: { claveOperacion: string; items: { productoId: string; cantidad: number }[]; expiraEn: Date }): Promise<void>;
}

export const RESERVA_INVENTARIO_PORT = Symbol('RESERVA_INVENTARIO_PORT');
