import { createHash } from 'node:crypto';
import { ErrorDeValidacion } from '../../../shared/domain/errors.js';

export interface LineaDeHuella {
  productoId: string;
  cantidad: number;
}

/**
 * Huella de trazabilidad del carrito procesado (DE-5): SHA-256 hexadecimal de `producto:cantidad` ordenado por producto
 * y unido con `|`. NO se usa para comparar reintentos.
 */
export function huellaCarrito(lineas: readonly LineaDeHuella[]): string {
  if (lineas.length === 0) throw new ErrorDeValidacion('No hay líneas de las que calcular la huella.');
  const vistos = new Set<string>();
  for (const l of lineas) {
    if (typeof l.productoId !== 'string' || l.productoId === '' || /[|:]/.test(l.productoId)) throw new ErrorDeValidacion('Producto inválido para la huella.');
    if (!Number.isInteger(l.cantidad) || l.cantidad < 1) throw new ErrorDeValidacion('Cantidad inválida para la huella.');
    if (vistos.has(l.productoId)) throw new ErrorDeValidacion('Producto repetido en la huella.');
    vistos.add(l.productoId);
  }
  const canonico = [...lineas]
    .sort((a, b) => (a.productoId < b.productoId ? -1 : 1))
    .map((l) => `${l.productoId}:${l.cantidad}`)
    .join('|');
  return createHash('sha256').update(canonico).digest('hex');
}
