import { ErrorDeValidacion } from '../../../shared/domain/errors.js';
import { StockFisicoInsuficienteError, StockInsuficienteError } from './errors.js';

/** Cantidad máxima por operación (evita desbordes y entradas absurdas). */
export const MAX_CANTIDAD = 1_000_000;

export function cantidadEntera(valor: unknown, { permitirNegativa = false }: { permitirNegativa?: boolean } = {}): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor)) throw new ErrorDeValidacion('La cantidad debe ser un número entero.');
  if (valor === 0 || (!permitirNegativa && valor < 0)) throw new ErrorDeValidacion(permitirNegativa ? 'La cantidad no puede ser cero.' : 'La cantidad debe ser mayor que cero.');
  if (Math.abs(valor) > MAX_CANTIDAD) throw new ErrorDeValidacion(`La cantidad no puede superar ${MAX_CANTIDAD}.`);
  return valor;
}

/**
 * Existencias de un producto en su puesto. Invariante: 0 ≤ reservado ≤ físico. Objeto inmutable.
 * Las mismas reglas las impone PostgreSQL de forma atómica (UPDATE condicional + CHECK); aquí son la referencia ejecutable.
 */
export class Stock {
  private constructor(readonly fisico: number, readonly reservado: number) {}

  static de(fisico: number, reservado: number): Stock {
    if (!Number.isInteger(fisico) || !Number.isInteger(reservado) || reservado < 0 || reservado > fisico) {
      throw new Error('Invariante de stock violada: 0 ≤ reservado ≤ físico.');
    }
    return new Stock(fisico, reservado);
  }
  static vacio = () => new Stock(0, 0);

  get disponible(): number { return this.fisico - this.reservado; }

  reservar(cantidad: number, productoId?: string): Stock {
    if (cantidad > this.disponible) throw new StockInsuficienteError(productoId);
    return new Stock(this.fisico, this.reservado + cantidad);
  }
  liberar(cantidad: number): Stock { return Stock.de(this.fisico, this.reservado - cantidad); }
  /** Venta de unidades ya reservadas: baja físico y reservado a la vez (no descuenta dos veces). */
  vender(cantidad: number): Stock { return Stock.de(this.fisico - cantidad, this.reservado - cantidad); }
  /** Variación del stock físico (ingreso, devolución o ajuste con signo). */
  variarFisico(delta: number): Stock {
    if (this.fisico + delta < this.reservado) throw new StockFisicoInsuficienteError();
    return new Stock(this.fisico + delta, this.reservado);
  }
}
