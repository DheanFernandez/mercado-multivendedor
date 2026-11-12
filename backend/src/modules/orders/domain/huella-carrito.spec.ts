import { describe, expect, it } from 'vitest';
import { ErrorDeValidacion } from '../../../shared/domain/errors.js';
import { huellaCarrito } from './huella-carrito.js';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

describe('huellaCarrito (trazabilidad, DE-5)', () => {
  it('es el SHA-256 hexadecimal de `producto:cantidad` ordenado por producto y unido con `|`', () => {
    expect(huellaCarrito([{ productoId: A, cantidad: 2 }, { productoId: B, cantidad: 3 }])).toBe('8c95a242b9b55c1f977c865b2a72ec75ffa1d8578ba9750fc4145b802e613889');
    expect(huellaCarrito([{ productoId: 'a', cantidad: 1 }])).toBe('2b2c40a6706d9e5f320d553628313833e3668d8b0c8f5b0a25a2ca7d926df6d4');
    expect(huellaCarrito([{ productoId: A, cantidad: 1 }])).toMatch(/^[0-9a-f]{64}$/);
  });

  it('el orden de entrada no cambia la huella (orden estable por producto)', () => {
    const l = [{ productoId: C, cantidad: 1 }, { productoId: A, cantidad: 2 }, { productoId: B, cantidad: 3 }];
    const esperada = huellaCarrito([{ productoId: A, cantidad: 2 }, { productoId: B, cantidad: 3 }, { productoId: C, cantidad: 1 }]);
    expect(huellaCarrito(l)).toBe(esperada);
    expect(huellaCarrito([...l].reverse())).toBe(esperada);
    expect(huellaCarrito([l[1]!, l[2]!, l[0]!])).toBe(esperada);
  });

  it('es sensible al contenido: cantidad, producto y número de líneas', () => {
    const base = huellaCarrito([{ productoId: A, cantidad: 2 }, { productoId: B, cantidad: 3 }]);
    expect(huellaCarrito([{ productoId: A, cantidad: 3 }, { productoId: B, cantidad: 3 }])).not.toBe(base);
    expect(huellaCarrito([{ productoId: A, cantidad: 2 }, { productoId: B, cantidad: 4 }])).not.toBe(base);
    expect(huellaCarrito([{ productoId: A, cantidad: 2 }, { productoId: C, cantidad: 3 }])).not.toBe(base);
    expect(huellaCarrito([{ productoId: A, cantidad: 2 }])).not.toBe(base);
    expect(huellaCarrito([{ productoId: A, cantidad: 2 }, { productoId: B, cantidad: 3 }, { productoId: C, cantidad: 1 }])).not.toBe(base);
  });

  it('no confunde cantidades con productos: {a:12} ≠ {a:1} + {2:1}', () => {
    expect(huellaCarrito([{ productoId: 'a', cantidad: 12 }])).not.toBe(huellaCarrito([{ productoId: 'a', cantidad: 1 }, { productoId: '2', cantidad: 1 }]));
  });

  it('no modifica la lista recibida', () => {
    const l = [{ productoId: B, cantidad: 1 }, { productoId: A, cantidad: 1 }];
    huellaCarrito(l);
    expect(l.map((x) => x.productoId)).toEqual([B, A]);
  });

  it.each([
    ['sin líneas', []],
    ['producto repetido', [{ productoId: A, cantidad: 1 }, { productoId: A, cantidad: 2 }]],
    ['producto vacío', [{ productoId: '', cantidad: 1 }]],
    ['cantidad cero', [{ productoId: A, cantidad: 0 }]],
    ['cantidad decimal', [{ productoId: A, cantidad: 1.5 }]],
    ['producto con separador', [{ productoId: 'a|b', cantidad: 1 }]],
    ['producto con dos puntos', [{ productoId: 'a:b', cantidad: 1 }]],
  ])('rechaza %s', (_n, l) => {
    expect(() => huellaCarrito(l)).toThrow(ErrorDeValidacion);
  });
});
