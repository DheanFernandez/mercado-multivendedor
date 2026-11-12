import { ErrorDeValidacion } from '../../../shared/domain/errors.js';

export const MAX_CANTIDAD_LINEA = 10_000;
/** 99 999 999.99 en céntimos (coincide con NUMERIC(10,2) y con el Precio compartido). */
export const MAX_PRECIO_CENTIMOS = 9_999_999_999;

/** Línea tal como llega desde el carrito, ya con los datos vigentes del catálogo. */
export interface LineaNueva {
  productoId: string;
  puesto: { id: string; codigo: string; nombre: string };
  nombre: string;
  unidadVenta: string;
  presentacion: string | null;
  cantidad: number;
  precioUnitarioCentimos: number;
}

export function textoObligatorio(v: unknown, que: string): string {
  if (typeof v !== 'string' || v.trim() === '') throw new ErrorDeValidacion(`${que} es obligatorio.`);
  return v;
}

/** Línea del pedido: instantánea inmutable con el precio vigente al crear (FR-009). Importes en céntimos enteros. */
export class LineaPedido {
  readonly subtotalCentimos: number;

  private constructor(
    readonly id: string,
    readonly productoId: string,
    readonly nombre: string,
    readonly unidadVenta: string,
    readonly presentacion: string | null,
    readonly cantidad: number,
    readonly precioUnitarioCentimos: number,
  ) {
    this.subtotalCentimos = cantidad * precioUnitarioCentimos;
    Object.freeze(this);
  }

  static crear(id: string, l: LineaNueva): LineaPedido {
    textoObligatorio(id, 'El identificador de la línea');
    textoObligatorio(l.productoId, 'El producto');
    textoObligatorio(l.nombre, 'El nombre del producto');
    textoObligatorio(l.unidadVenta, 'La unidad de venta');
    if (l.presentacion !== null) textoObligatorio(l.presentacion, 'La presentación');
    if (!Number.isInteger(l.cantidad) || l.cantidad < 1 || l.cantidad > MAX_CANTIDAD_LINEA) {
      throw new ErrorDeValidacion(`La cantidad debe ser un entero entre 1 y ${MAX_CANTIDAD_LINEA}.`);
    }
    if (!Number.isInteger(l.precioUnitarioCentimos) || l.precioUnitarioCentimos < 1 || l.precioUnitarioCentimos > MAX_PRECIO_CENTIMOS) {
      throw new ErrorDeValidacion('El precio unitario debe ser un importe entero en céntimos entre 1 y 9999999999.');
    }
    return new LineaPedido(id, l.productoId, l.nombre, l.unidadVenta, l.presentacion, l.cantidad, l.precioUnitarioCentimos);
  }
}
