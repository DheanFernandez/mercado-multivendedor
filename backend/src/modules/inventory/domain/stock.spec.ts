import { describe, expect, it } from 'vitest';
import { ErrorDeValidacion } from '../../../shared/domain/errors.js';
import { StockFisicoInsuficienteError, StockInsuficienteError } from './errors.js';
import { cantidadEntera, MAX_CANTIDAD, Stock } from './stock.js';

describe('Stock (RF14, RF15)', () => {
  it('distingue físico, reservado y disponible', () => {
    const s = Stock.de(10, 4);
    expect([s.fisico, s.reservado, s.disponible]).toEqual([10, 4, 6]);
  });

  it('reserva exactamente el disponible y no más (stock suficiente / insuficiente)', () => {
    const s = Stock.de(5, 2);
    expect(s.reservar(3).disponible).toBe(0);
    expect(() => s.reservar(4)).toThrow(StockInsuficienteError);
  });

  it('con el último stock, solo una reserva cabe', () => {
    const uno = Stock.de(1, 0).reservar(1);
    expect(() => uno.reservar(1)).toThrow(StockInsuficienteError);
  });

  it('liberar devuelve unidades; vender baja físico y reservado a la vez (sin descontar dos veces)', () => {
    const r = Stock.de(10, 6);
    expect(r.liberar(6)).toMatchObject({ fisico: 10, reservado: 0 });
    const v = r.vender(4);
    expect([v.fisico, v.reservado, v.disponible]).toEqual([6, 2, 4]);
  });

  it('no permite stock negativo ni liberar/vender más de lo reservado', () => {
    expect(() => Stock.de(5, 2).liberar(3)).toThrow(/Invariante/);
    expect(() => Stock.de(5, 2).vender(3)).toThrow(/Invariante/);
    expect(() => Stock.de(2, 0).variarFisico(-3)).toThrow(StockFisicoInsuficienteError);
  });

  it('un ajuste no puede dejar el físico por debajo de lo reservado', () => {
    const s = Stock.de(10, 7);
    expect(s.variarFisico(-3).fisico).toBe(7);
    expect(() => s.variarFisico(-4)).toThrow(StockFisicoInsuficienteError);
  });

  it('rechaza estados que violan 0 ≤ reservado ≤ físico', () => {
    expect(() => Stock.de(1, 2)).toThrow();
    expect(() => Stock.de(1, -1)).toThrow();
    expect(() => Stock.de(1.5, 0)).toThrow();
  });
});

describe('cantidadEntera', () => {
  it('acepta enteros positivos', () => expect(cantidadEntera(3)).toBe(3));
  it.each([0, -1, 1.5, '3', null, undefined, NaN, MAX_CANTIDAD + 1])('rechaza %s', (v) => {
    expect(() => cantidadEntera(v)).toThrow(ErrorDeValidacion);
  });
  it('con permitirNegativa acepta negativos pero no cero', () => {
    expect(cantidadEntera(-5, { permitirNegativa: true })).toBe(-5);
    expect(() => cantidadEntera(0, { permitirNegativa: true })).toThrow(ErrorDeValidacion);
  });
});
