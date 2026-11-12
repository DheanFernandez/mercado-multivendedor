import { ErrorDeConflicto } from '../../../shared/domain/errors.js';
import type { EstadoSubpedido } from './estado-subpedido.js';

/** El carrito no tiene líneas: no hay nada que convertir en pedido (FR-008). */
export class CarritoVacioError extends ErrorDeConflicto {
  constructor() {
    super('El carrito está vacío.');
  }
}

/** El carrito tiene productos que ya no se pueden comprar: se rechaza en bloque sin crear nada (FR-008, CA-O8). */
export class LineasNoVigentesError extends ErrorDeConflicto {
  constructor(readonly productoIds: readonly string[]) {
    super('El carrito tiene productos que ya no están disponibles.');
  }
}

/**
 * Lo leído de la persistencia no forma un pedido coherente (importes que no cuadran, historial roto, …). Es un fallo
 * INESPERADO (dato corrupto o defecto): a propósito no hereda de `ErrorDeDominio`, para que no se traduzca a un 4xx.
 */
export class ReconstitucionInvalidaError extends Error {
  constructor(mensaje: string, opciones?: { cause?: unknown }) {
    super(`Pedido persistido incoherente: ${mensaje}`, opciones);
    this.name = 'ReconstitucionInvalidaError';
  }
}

/** Transición de estado fuera del diagrama aprobado (C4 N4 §3; FR-019, CA-O19). */
export class TransicionEstadoInvalidaError extends ErrorDeConflicto {
  constructor(readonly desde: EstadoSubpedido, readonly hacia: string) {
    super(`No se puede pasar de ${desde} a ${hacia}.`);
  }
}
