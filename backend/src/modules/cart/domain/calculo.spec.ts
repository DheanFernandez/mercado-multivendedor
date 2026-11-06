import { describe, expect, it } from 'vitest';
import { ErrorDeValidacion } from '../../../shared/domain/errors.js';
import { calcularCarrito, cantidadDeItem, formatearCentimos, MAX_CANTIDAD_ITEM, type LineaEntrada } from './calculo.js';

const puesto = (n: number) => ({ id: `p${n}`, codigo: `P-${n}`, nombre: `Puesto ${n}` });
const linea = (id: string, p: number, centimos: number, cantidad: number, disponible = 1000): LineaEntrada => ({
  productoId: id, puestoId: `p${p}`, cantidad, disponible,
  producto: { nombre: `Prod ${id}`, unidadVenta: 'UNIDAD', presentacion: null, precioCentimos: centimos, puesto: puesto(p) },
});

describe('formatearCentimos', () => {
  it('formatea con dos decimales exactos', () => {
    expect(formatearCentimos(0)).toBe('0.00');
    expect(formatearCentimos(5)).toBe('0.05');
    expect(formatearCentimos(1250)).toBe('12.50');
    expect(formatearCentimos(9_999_999_999)).toBe('99999999.99');
  });
});

describe('cantidadDeItem', () => {
  it('acepta enteros de 1 al máximo y rechaza el resto', () => {
    expect(cantidadDeItem(1)).toBe(1);
    expect(cantidadDeItem(MAX_CANTIDAD_ITEM)).toBe(MAX_CANTIDAD_ITEM);
    for (const malo of [0, -1, 1.5, MAX_CANTIDAD_ITEM + 1, '2', null, undefined, NaN, Infinity]) {
      expect(() => cantidadDeItem(malo)).toThrow(ErrorDeValidacion);
    }
  });
});

describe('calcularCarrito (RF21–RF23)', () => {
  it('un carrito vacío da total 0.00', () => {
    expect(calcularCarrito([])).toEqual({ puestos: [], total: '0.00', totalProductos: 0, requiereRevision: false });
  });

  it('agrupa por puesto, calcula subtotales y total general con importes exactos (tres puestos)', () => {
    const r = calcularCarrito([
      linea('a', 1, 650, 3),   // 19.50
      linea('b', 2, 1099, 2),  // 21.98
      linea('c', 1, 125, 4),   //  5.00
      linea('d', 3, 9_999, 1), // 99.99
    ]);
    expect(r.puestos.map((g) => [g.puesto.id, g.subtotal, g.items.length])).toEqual([['p1', '24.50', 2], ['p2', '21.98', 1], ['p3', '99.99', 1]]);
    expect(r.total).toBe('146.47');
    expect(r.totalProductos).toBe(10);
    expect(r.requiereRevision).toBe(false);
    expect(r.puestos[0]!.items[0]).toMatchObject({ productoId: 'a', precioUnitario: '6.50', subtotal: '19.50', estado: 'OK' });
  });

  it('el total es la suma de los subtotales por puesto', () => {
    const r = calcularCarrito([linea('a', 1, 1, 3), linea('b', 2, 33, 3), linea('c', 3, 7, 7)]);
    const suma = r.puestos.reduce((s, g) => s + Math.round(Number(g.subtotal) * 100), 0);
    expect(Math.round(Number(r.total) * 100)).toBe(suma);
  });

  it('no acumula error de coma flotante (0.10 × 3 = 0.30; 19.99 × 3 = 59.97)', () => {
    expect(calcularCarrito([linea('a', 1, 10, 3)]).total).toBe('0.30');
    expect(calcularCarrito([linea('a', 1, 1999, 3)]).total).toBe('59.97');
  });

  it('importes máximos: 50 líneas de 99 999 999.99 × 10 000 siguen siendo exactas', () => {
    const lineas = Array.from({ length: 50 }, (_, i) => linea(`x${i}`, 1, 9_999_999_999, 10_000, 10_000));
    const r = calcularCarrito(lineas);
    expect(r.total).toBe('49999999995000.00');
    expect(r.puestos[0]!.subtotal).toBe(r.total);
  });

  it('una línea con cantidad superior al stock se informa pero no suma, y exige revisión', () => {
    const r = calcularCarrito([linea('a', 1, 500, 2, 10), linea('b', 1, 500, 5, 3)]);
    expect(r.total).toBe('10.00');
    expect(r.totalProductos).toBe(2);
    expect(r.requiereRevision).toBe(true);
    expect(r.puestos[0]!.items.map((i) => i.estado)).toEqual(['OK', 'STOCK_INSUFICIENTE']);
    expect(r.puestos[0]!.items[1]).toMatchObject({ disponible: 3, subtotal: '25.00' });
  });

  it('un producto que ya no se puede comprar se informa sin precio, no suma y exige revisión', () => {
    const r = calcularCarrito([{ productoId: 'z', puestoId: 'p9', cantidad: 2, producto: null, disponible: 0 }, linea('a', 1, 500, 1)]);
    expect(r.total).toBe('5.00');
    expect(r.requiereRevision).toBe(true);
    const grupo = r.puestos.find((g) => g.puesto.id === 'p9')!;
    expect(grupo.subtotal).toBe('0.00');
    expect(grupo.items[0]).toMatchObject({ estado: 'NO_DISPONIBLE', nombre: null, precioUnitario: null, subtotal: null });
  });
});
