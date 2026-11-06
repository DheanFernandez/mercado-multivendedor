import { ErrorDeConflicto, ErrorNoEncontrado } from '../../../shared/domain/errors.js';

/** El producto no existe, no está publicado o su puesto/categoría están inactivos (RF19). */
export class ProductoNoDisponibleError extends ErrorNoEncontrado {
  constructor() { super('El producto no está disponible.'); }
}
export class ItemNoEncontradoError extends ErrorNoEncontrado {
  constructor() { super('El producto no está en el carrito.'); }
}
/** La cantidad pedida (sumada a lo que ya hay en el carrito) supera el stock disponible (RF15). */
export class StockInsuficienteCarritoError extends ErrorDeConflicto {
  constructor(readonly disponible: number) {
    super(`No hay stock suficiente: quedan ${disponible} unidad(es) disponibles.`);
  }
}
export class LimiteItemsCarritoError extends ErrorDeConflicto {
  constructor(max: number) { super(`El carrito admite como máximo ${max} productos distintos.`); }
}
