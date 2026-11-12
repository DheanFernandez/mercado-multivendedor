import { describe, expect, it } from 'vitest';
import { Prisma } from '../../../generated/prisma/client.js';
import { centimosDesdeDecimal, decimalDesdeCentimos } from './importes.js';

describe('NUMERIC ⇄ céntimos sin coma flotante (T012)', () => {
  it.each([
    [0, '0.00'], [1, '0.01'], [10, '0.10'], [30, '0.30'], [5997, '59.97'], [650, '6.50'], [9_999_999_999, '99999999.99'],
    [99_999_999_990_000, '999999999900.00'], [4_999_999_999_500_000, '49999999995000.00'],
  ])('%i céntimos ⇄ "%s"', (centimos, texto) => {
    expect(decimalDesdeCentimos(centimos)).toBe(texto);
    expect(centimosDesdeDecimal(texto)).toBe(centimos);
    expect(centimosDesdeDecimal(new Prisma.Decimal(texto))).toBe(centimos);
  });

  it('casos en los que la coma flotante falla: 0.1 + 0.2 y 19.99 × 3', () => {
    expect(centimosDesdeDecimal(new Prisma.Decimal('0.1').plus('0.2'))).toBe(30);
    expect(centimosDesdeDecimal(new Prisma.Decimal('19.99').times(3))).toBe(5997);
    expect(0.1 + 0.2).not.toBe(0.3); // la razón de no usar Number intermedios
    expect(centimosDesdeDecimal(new Prisma.Decimal('1.005').minus('0.005'))).toBe(100); // 1.005 × 100 en double da 100.49999…
  });

  it('acepta un NUMERIC con un solo decimal o sin decimales tal como lo devuelve PostgreSQL', () => {
    expect(centimosDesdeDecimal(new Prisma.Decimal('12'))).toBe(1200);
    expect(centimosDesdeDecimal(new Prisma.Decimal('12.5'))).toBe(1250);
  });

  it('rechaza lo que no es un importe exacto en céntimos (en lugar de redondear en silencio)', () => {
    for (const malo of ['1.234', 'abc', '', '1e3', '-0.01', '12.']) expect(() => centimosDesdeDecimal(malo), malo).toThrow();
    expect(() => centimosDesdeDecimal(new Prisma.Decimal('0.005'))).toThrow();
    expect(() => centimosDesdeDecimal('99999999999999999.99')).toThrow(); // fuera de los enteros exactos
  });

  it('en el borde de los enteros exactos: MAX_SAFE_INTEGER céntimos se convierte exacto y el siguiente se rechaza', () => {
    expect(centimosDesdeDecimal('90071992547409.91')).toBe(Number.MAX_SAFE_INTEGER);
    expect(decimalDesdeCentimos(Number.MAX_SAFE_INTEGER)).toBe('90071992547409.91');
    expect(() => centimosDesdeDecimal('90071992547409.92')).toThrow(/rango/);
  });

  it('rechaza céntimos que no son enteros seguros no negativos', () => {
    for (const malo of [1.5, -1, Number.NaN, Number.MAX_SAFE_INTEGER + 2]) expect(() => decimalDesdeCentimos(malo), String(malo)).toThrow();
  });
});
