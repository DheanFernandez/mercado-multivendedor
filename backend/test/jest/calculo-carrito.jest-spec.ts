/**
 * Suite representativa con Jest (spec 006): cálculo del carrito (RF21–RF23). Importes en céntimos enteros, sin coma flotante.
 */
import { describe, expect, it } from '@jest/globals';
import { ErrorDeValidacion } from '../../src/shared/domain/errors.js';
import { calcularCarrito, cantidadDeItem, formatearCentimos, MAX_CANTIDAD_ITEM, type LineaEntrada } from '../../src/modules/cart/domain/calculo.js';

const A = { id: 'puesto-a', codigo: 'A-1', nombre: 'Puesto A' };
const B = { id: 'puesto-b', codigo: 'B-1', nombre: 'Puesto B' };
const linea = (productoId: string, puesto: typeof A, precioCentimos: number, cantidad: number, disponible: number): LineaEntrada => ({
  productoId,
  puestoId: puesto.id,
  cantidad,
  disponible,
  producto: { nombre: productoId, unidadVenta: 'KILOGRAMO', presentacion: null, precioCentimos, puesto },
});

describe('formatearCentimos', () => {
  it.each([
    [0, '0.00'],
    [5, '0.05'],
    [650, '6.50'],
    [1250, '12.50'],
    [9_999_999_999, '99999999.99'],
  ])('%p céntimos → %p', (centimos, texto) => {
    expect(formatearCentimos(centimos)).toBe(texto);
  });
});

describe('cantidadDeItem', () => {
  it('acepta enteros de 1 al máximo', () => {
    expect(cantidadDeItem(1)).toBe(1);
    expect(cantidadDeItem(MAX_CANTIDAD_ITEM)).toBe(MAX_CANTIDAD_ITEM);
  });
  it.each([0, -2, 2.5, '4', undefined, null, MAX_CANTIDAD_ITEM + 1])('rechaza %p', (v) => {
    expect(() => cantidadDeItem(v)).toThrow(ErrorDeValidacion);
  });
});

describe('calcularCarrito', () => {
  it('un carrito vacío no requiere revisión y suma cero', () => {
    expect(calcularCarrito([])).toEqual({ puestos: [], total: '0.00', totalProductos: 0, requiereRevision: false });
  });

  it('agrupa por puesto, calcula subtotales exactos y el total es la suma de los subtotales', () => {
    const r = calcularCarrito([linea('mango', A, 650, 3, 10), linea('papa', B, 225, 4, 20), linea('limon', A, 199, 2, 5)]);
    expect(r.puestos).toHaveLength(2);
    expect(r.puestos.find((g) => g.puesto.id === 'puesto-a')).toMatchObject({ subtotal: '23.48', puesto: { codigo: 'A-1' } });
    expect(r.puestos.find((g) => g.puesto.id === 'puesto-b')?.subtotal).toBe('9.00');
    expect(r.total).toBe('32.48');
    expect(r.totalProductos).toBe(9);
    expect(r.requiereRevision).toBe(false);
  });

  it('evita errores de coma flotante en importes como 0.10 + 0.20', () => {
    const r = calcularCarrito([linea('a', A, 10, 1, 5), linea('b', A, 20, 1, 5)]);
    expect(r.total).toBe('0.30');
  });

  it('una línea por encima del disponible se informa pero NO suma y exige revisión', () => {
    const r = calcularCarrito([linea('mango', A, 650, 3, 10), linea('palta', B, 1200, 5, 2)]);
    const palta = r.puestos.flatMap((g) => g.items).find((i) => i.productoId === 'palta');
    expect(palta).toMatchObject({ estado: 'STOCK_INSUFICIENTE', subtotal: '60.00', disponible: 2 });
    expect(r.puestos.find((g) => g.puesto.id === 'puesto-b')?.subtotal).toBe('0.00');
    expect(r.total).toBe('19.50');
    expect(r.totalProductos).toBe(3);
    expect(r.requiereRevision).toBe(true);
  });

  it('un producto que ya no se puede comprar queda sin precio, no suma y exige revisión', () => {
    const r = calcularCarrito([{ productoId: 'x', puestoId: 'puesto-a', cantidad: 2, producto: null, disponible: 0 }]);
    expect(r.puestos[0]?.items[0]).toMatchObject({ estado: 'NO_DISPONIBLE', nombre: null, precioUnitario: null, subtotal: null });
    expect(r.total).toBe('0.00');
    expect(r.requiereRevision).toBe(true);
  });

  it('exactamente el disponible todavía es vigente', () => {
    const r = calcularCarrito([linea('mango', A, 650, 10, 10)]);
    expect(r.puestos[0]?.items[0]?.estado).toBe('OK');
    expect(r.total).toBe('65.00');
  });
});
