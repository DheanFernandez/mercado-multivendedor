import { ErrorDeValidacion } from './errors.js';

/**
 * Importe en soles representado en céntimos enteros: nunca coma flotante.
 * Rango: 0.01 a 99 999 999.99 (coincide con NUMERIC(10,2)).
 */
export class Precio {
  private constructor(readonly centimos: number) {}

  /** Acepta "12", "12.5" o "12.50" (texto) o un número con a lo sumo 2 decimales exactos. */
  static desde(valor: unknown): Precio {
    const texto = typeof valor === 'number' ? String(valor) : typeof valor === 'string' ? valor.trim() : '';
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(texto)) {
      throw new ErrorDeValidacion('El precio debe ser un importe en soles con hasta 2 decimales (máximo 99999999.99).');
    }
    const [entero, decimales = ''] = texto.split('.');
    const centimos = Number(entero) * 100 + Number(decimales.padEnd(2, '0'));
    if (centimos < 1) throw new ErrorDeValidacion('El precio debe ser mayor que cero.');
    return new Precio(centimos);
  }

  static desdeCentimos(centimos: number): Precio {
    if (!Number.isInteger(centimos) || centimos < 1) throw new ErrorDeValidacion('Precio inválido.');
    return new Precio(centimos);
  }

  /** Forma canónica con dos decimales, p. ej. "12.50". */
  toString(): string {
    return `${Math.trunc(this.centimos / 100)}.${String(this.centimos % 100).padStart(2, '0')}`;
  }
}
