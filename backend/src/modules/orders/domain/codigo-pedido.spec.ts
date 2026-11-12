import { randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ErrorDeValidacion } from '../../../shared/domain/errors.js';
import { ALFABETO_CODIGO, esCodigoPedidoValido, generarCodigoPedido } from './codigo-pedido.js';

/** Aleatoriedad inyectada y determinista: el n-ésimo código usa los 8 dígitos en base 32 de n (nunca se repite). */
function secuencia() {
  let n = 0;
  let pendientes: number[] = [];
  return (maximo: number): number => {
    if (pendientes.length === 0) {
      let v = ++n;
      pendientes = Array.from({ length: 8 }, () => {
        const d = v % 32;
        v = Math.floor(v / 32);
        return d;
      });
    }
    expect(maximo).toBe(32);
    return pendientes.pop()!;
  };
}

describe('alfabeto', () => {
  it('son los 32 caracteres aprobados: dígitos y letras sin I, L, O ni U', () => {
    expect(ALFABETO_CODIGO).toBe('0123456789ABCDEFGHJKMNPQRSTVWXYZ');
    expect(ALFABETO_CODIGO).toHaveLength(32);
    expect(new Set(ALFABETO_CODIGO).size).toBe(32);
    for (const c of ['I', 'L', 'O', 'U']) expect(ALFABETO_CODIGO).not.toContain(c);
  });
});

describe('generarCodigoPedido', () => {
  it('forma `PED-` + 8 caracteres del alfabeto', () => {
    const c = generarCodigoPedido(secuencia());
    expect(c).toMatch(/^PED-[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(c).toHaveLength(12);
  });

  it('traduce cada número aleatorio al carácter de su posición y consulta con el tope 32, ocho veces', () => {
    const pedidos: number[] = [];
    const valores = [0, 1, 9, 10, 31, 17, 22, 5];
    let i = 0;
    const c = generarCodigoPedido((max) => {
      pedidos.push(max);
      return valores[i++]!;
    });
    expect(c).toBe(`PED-${valores.map((v) => ALFABETO_CODIGO[v]).join('')}`);
    expect(c).toBe('PED-019AZHP5');
    expect(pedidos).toEqual(Array(8).fill(32));
  });

  it('alcanza los dos extremos del alfabeto (0 y 31)', () => {
    expect(generarCodigoPedido(() => 0)).toBe('PED-00000000');
    expect(generarCodigoPedido(() => 31)).toBe('PED-ZZZZZZZZ');
  });

  it.each([[-1], [32], [1.5], [Number.NaN], [Number.POSITIVE_INFINITY]])('rechaza un número fuera de rango o no entero (%s)', (malo) => {
    expect(() => generarCodigoPedido(() => malo)).toThrow(ErrorDeValidacion);
  });

  it('1 000 códigos con aleatoriedad inyectada no se repiten', () => {
    const azar = secuencia();
    const codigos = new Set(Array.from({ length: 1000 }, () => generarCodigoPedido(azar)));
    expect(codigos.size).toBe(1000);
    for (const c of codigos) expect(esCodigoPedidoValido(c)).toBe(true);
  });

  it('con la aleatoriedad criptográfica real: 1 000 códigos válidos y distintos', () => {
    const codigos = new Set(Array.from({ length: 1000 }, () => generarCodigoPedido((m) => randomInt(m))));
    expect(codigos.size).toBe(1000);
    for (const c of codigos) expect(c).toMatch(/^PED-[0-9A-HJKMNP-TV-Z]{8}$/);
  });
});

describe('esCodigoPedidoValido', () => {
  it.each(['PED-00000000', 'PED-ZZZZZZZZ', 'PED-7K3MQ9XA'])('acepta %s', (c) => expect(esCodigoPedidoValido(c)).toBe(true));

  it.each([
    ['sin prefijo', '7K3MQ9XA'],
    ['prefijo en minúsculas', 'ped-7K3MQ9XA'],
    ['corto', 'PED-7K3MQ9X'],
    ['largo', 'PED-7K3MQ9XAB'],
    ['con I', 'PED-7K3MQ9XI'],
    ['con L', 'PED-7K3MQ9XL'],
    ['con O', 'PED-7K3MQ9XO'],
    ['con U', 'PED-7K3MQ9XU'],
    ['minúsculas', 'PED-7k3mq9xa'],
    ['espacio', 'PED-7K3MQ9X '],
    ['salto de línea final', 'PED-7K3MQ9XA\n'],
    ['vacío', ''],
    ['guion extra', 'PED--7K3MQ9XA'],
    ['prefijo repetido', 'PED-PED-7K3MQ9XA'],
  ])('rechaza %s', (_n, c) => expect(esCodigoPedidoValido(c)).toBe(false));

  it('rechaza lo que no es texto', () => {
    for (const v of [null, undefined, 12, {}]) expect(esCodigoPedidoValido(v as never)).toBe(false);
  });
});
