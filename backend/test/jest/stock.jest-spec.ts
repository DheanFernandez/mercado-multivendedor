/**
 * Suite representativa con Jest (spec 006): invariantes de stock (RF12–RF14; ADR-003). Sin red, PostgreSQL ni Supabase.
 */
import { describe, expect, it } from '@jest/globals';
import { ErrorDeValidacion } from '../../src/shared/domain/errors.js';
import { StockFisicoInsuficienteError, StockInsuficienteError } from '../../src/modules/inventory/domain/errors.js';
import { cantidadEntera, MAX_CANTIDAD, Stock } from '../../src/modules/inventory/domain/stock.js';

describe('Stock · invariante 0 ≤ reservado ≤ físico', () => {
  it('calcula el disponible como físico menos reservado', () => {
    expect(Stock.de(10, 3).disponible).toBe(7);
    expect(Stock.vacio().disponible).toBe(0);
  });

  it.each([
    [5, 6],
    [5, -1],
    [1.5, 0],
    [5, 0.5],
  ])('rechaza existencias inválidas (físico %p, reservado %p)', (fisico, reservado) => {
    expect(() => Stock.de(fisico, reservado)).toThrow('Invariante de stock violada');
  });

  it('reservar descuenta del disponible sin tocar el físico y es inmutable', () => {
    const inicial = Stock.de(10, 0);
    const reservado = inicial.reservar(4);
    expect(reservado).toMatchObject({ fisico: 10, reservado: 4, disponible: 6 });
    expect(inicial).toMatchObject({ fisico: 10, reservado: 0 });
  });

  it('no permite reservar más que el disponible', () => {
    expect(() => Stock.de(10, 8).reservar(3, 'producto-1')).toThrow(StockInsuficienteError);
    expect(Stock.de(10, 8).reservar(2).disponible).toBe(0);
  });

  it('liberar devuelve unidades y nunca deja el reservado negativo', () => {
    expect(Stock.de(10, 4).liberar(4)).toMatchObject({ fisico: 10, reservado: 0 });
    expect(() => Stock.de(10, 4).liberar(5)).toThrow('Invariante de stock violada');
  });

  it('vender convierte lo reservado en venta: baja físico y reservado a la vez, sin descontar dos veces', () => {
    const despues = Stock.de(10, 4).vender(4);
    expect(despues).toMatchObject({ fisico: 6, reservado: 0, disponible: 6 });
    expect(() => Stock.de(10, 2).vender(3)).toThrow('Invariante de stock violada');
  });

  it('variar el físico admite ingresos y ajustes negativos, pero no por debajo de lo reservado', () => {
    expect(Stock.de(10, 4).variarFisico(5).fisico).toBe(15);
    expect(Stock.de(10, 4).variarFisico(-6).fisico).toBe(4);
    expect(() => Stock.de(10, 4).variarFisico(-7)).toThrow(StockFisicoInsuficienteError);
  });
});

describe('cantidadEntera', () => {
  it('acepta enteros positivos hasta el máximo', () => {
    expect(cantidadEntera(1)).toBe(1);
    expect(cantidadEntera(MAX_CANTIDAD)).toBe(MAX_CANTIDAD);
  });

  it.each([0, -1, 1.5, '3', null, undefined, Number.NaN, MAX_CANTIDAD + 1])('rechaza %p', (valor) => {
    expect(() => cantidadEntera(valor)).toThrow(ErrorDeValidacion);
  });

  it('con permitirNegativa admite negativos, pero nunca cero ni más del máximo', () => {
    expect(cantidadEntera(-3, { permitirNegativa: true })).toBe(-3);
    expect(() => cantidadEntera(0, { permitirNegativa: true })).toThrow('no puede ser cero');
    expect(() => cantidadEntera(-(MAX_CANTIDAD + 1), { permitirNegativa: true })).toThrow(ErrorDeValidacion);
  });
});
