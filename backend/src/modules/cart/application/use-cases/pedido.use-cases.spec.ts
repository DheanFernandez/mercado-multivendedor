import { describe, expect, it } from 'vitest';
import { ErrorDeValidacion } from '../../../../shared/domain/errors.js';
import { UnidadDeTrabajoRequeridaError } from '../../../../shared/domain/unidad-de-trabajo.error.js';
import type { CarritoRepository, ItemGuardado, ProductoVendible } from '../ports/ports.js';
import { ObtenerCarritoParaPedido, VaciarCarritoDelPedido } from './pedido.use-cases.js';
import { CarritoEnMemoria, ProductosVendiblesLoteFalsos } from './test-doubles.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CLIENTE = id(1);
const OTRO = id(2);
const PUESTO_A = { id: id(301), codigo: 'A-1', nombre: 'Puesto A' };
const PUESTO_B = { id: id(302), codigo: 'B-1', nombre: 'Puesto B' };
const vendible = (n: number, nombre: string, precioCentimos: number, puesto = PUESTO_A): ProductoVendible => ({
  productoId: id(n), nombre, unidadVenta: 'KILOGRAMO', presentacion: null, precioCentimos, puesto,
});

function montar(vendibles: ProductoVendible[]) {
  const carrito = new CarritoEnMemoria();
  const lote = new ProductosVendiblesLoteFalsos(Object.fromEntries(vendibles.map((v) => [v.productoId, v])));
  return { carrito, lote, obtener: new ObtenerCarritoParaPedido(carrito, lote), vaciar: new VaciarCarritoDelPedido(carrito) };
}
const agregar = (c: CarritoEnMemoria, usuarioId: string, productoId: string, puestoId: string, cantidad: number) =>
  c.agregar({ usuarioId, productoId, puestoId, cantidad, tope: 1000, maxItems: 50 });

describe('ObtenerCarritoParaPedido', () => {
  it('exige una unidad de trabajo vigente: sin ella falla de inmediato y no consulta el catálogo', async () => {
    const { obtener, lote } = montar([vendible(10, 'Mango', 650)]);
    await expect(obtener.ejecutar(CLIENTE)).rejects.toBeInstanceOf(UnidadDeTrabajoRequeridaError);
    expect(lote.llamadas).toEqual([]);
  });

  it('un cliente sin carrito devuelve carritoId nulo y ninguna línea, sin consultar el catálogo', async () => {
    const { obtener, carrito, lote } = montar([vendible(10, 'Mango', 650)]);
    const r = await carrito.conUnidad(() => obtener.ejecutar(CLIENTE));
    expect(r).toEqual({ carritoId: null, lineas: [] });
    expect(lote.llamadas).toEqual([]);
  });

  it('un carrito existente pero vacío conserva su identificador y no consulta el catálogo', async () => {
    const { obtener, carrito, lote } = montar([vendible(10, 'Mango', 650)]);
    await agregar(carrito, CLIENTE, id(10), PUESTO_A.id, 1);
    await carrito.quitar({ usuarioId: CLIENTE, productoId: id(10) });
    const r = await carrito.conUnidad(() => obtener.ejecutar(CLIENTE));
    expect(r.carritoId).toBe(`carrito-${CLIENTE}`);
    expect(r.lineas).toEqual([]);
    expect(lote.llamadas).toEqual([]);
  });

  it('devuelve cada línea con su puesto, datos del catálogo y precio en céntimos enteros (sin coma flotante)', async () => {
    const { obtener, carrito } = montar([vendible(10, 'Mango', 650), vendible(11, 'Cilantro', 10, PUESTO_B), vendible(12, 'Palta', 1999, PUESTO_B)]);
    await agregar(carrito, CLIENTE, id(10), PUESTO_A.id, 3);
    await agregar(carrito, CLIENTE, id(11), PUESTO_B.id, 3);
    await agregar(carrito, CLIENTE, id(12), PUESTO_B.id, 3);
    const r = await carrito.conUnidad(() => obtener.ejecutar(CLIENTE));
    expect(r.lineas.map((l) => [l.productoId, l.nombre, l.cantidad, l.precioUnitarioCentimos, l.puesto?.codigo, l.comprable])).toEqual([
      [id(10), 'Mango', 3, 650, 'A-1', true],
      [id(11), 'Cilantro', 3, 10, 'B-1', true],
      [id(12), 'Palta', 3, 1999, 'B-1', true],
    ]);
    expect(r.lineas[0]).toMatchObject({ unidadVenta: 'KILOGRAMO', presentacion: null });
  });

  it('marca como no comprable (sin puesto, nombre ni precio) un producto que el catálogo ya no expone', async () => {
    const { obtener, carrito } = montar([vendible(10, 'Mango', 650)]); // el 11 ya no está publicado
    await agregar(carrito, CLIENTE, id(10), PUESTO_A.id, 1);
    await agregar(carrito, CLIENTE, id(11), PUESTO_B.id, 2);
    const r = await carrito.conUnidad(() => obtener.ejecutar(CLIENTE));
    expect(r.lineas.find((l) => l.productoId === id(10))).toMatchObject({ comprable: true });
    expect(r.lineas.find((l) => l.productoId === id(11))).toEqual({
      productoId: id(11), puesto: null, nombre: null, unidadVenta: null, presentacion: null, cantidad: 2, precioUnitarioCentimos: null, comprable: false,
    });
  });

  it('el orden es estable por producto aunque el repositorio las entregue desordenadas', async () => {
    const productos = [vendible(10, 'A', 100), vendible(11, 'B', 100), vendible(12, 'C', 100)];
    const items: ItemGuardado[] = [{ productoId: id(12), puestoId: PUESTO_A.id, cantidad: 1 }, { productoId: id(10), puestoId: PUESTO_A.id, cantidad: 1 }, { productoId: id(11), puestoId: PUESTO_A.id, cantidad: 1 }];
    const desordenado = { bloquearYListar: async () => ({ carritoId: 'c', items }) } as unknown as CarritoRepository;
    const r = await new ObtenerCarritoParaPedido(desordenado, new ProductosVendiblesLoteFalsos(Object.fromEntries(productos.map((p) => [p.productoId, p])))).ejecutar(CLIENTE);
    expect(r.lineas.map((l) => l.productoId)).toEqual([id(10), id(11), id(12)]);
  });

  it('consulta el catálogo UNA sola vez, con todos los productos', async () => {
    const { obtener, carrito, lote } = montar([vendible(10, 'A', 100), vendible(11, 'B', 100), vendible(12, 'C', 100)]);
    for (const n of [12, 10, 11]) await agregar(carrito, CLIENTE, id(n), PUESTO_A.id, 1);
    await carrito.conUnidad(() => obtener.ejecutar(CLIENTE));
    expect(lote.llamadas).toHaveLength(1);
    expect([...lote.llamadas[0]!].sort()).toEqual([id(10), id(11), id(12)]);
  });

  it('cada cliente solo ve su carrito', async () => {
    const { obtener, carrito } = montar([vendible(10, 'Mango', 650)]);
    await agregar(carrito, CLIENTE, id(10), PUESTO_A.id, 5);
    const otro = await carrito.conUnidad(() => obtener.ejecutar(OTRO));
    expect(otro).toEqual({ carritoId: null, lineas: [] });
  });

  it.each([['vacío', ''], ['no UUID', 'abc'], ['número', 5]])('rechaza un identificador de cliente inválido (%s) sin leer el carrito', async (_n, valor) => {
    const { obtener, carrito } = montar([]);
    await expect(carrito.conUnidad(() => obtener.ejecutar(valor as string))).rejects.toBeInstanceOf(ErrorDeValidacion);
    expect(carrito.bloqueos).toBe(0);
  });
});

describe('VaciarCarritoDelPedido', () => {
  it('exige una unidad de trabajo vigente', async () => {
    const { vaciar, carrito } = montar([]);
    await agregar(carrito, CLIENTE, id(10), PUESTO_A.id, 1);
    await expect(vaciar.ejecutar(CLIENTE)).rejects.toBeInstanceOf(UnidadDeTrabajoRequeridaError);
    expect(await carrito.listar(CLIENTE)).toHaveLength(1);
  });

  it('dentro de una unidad borra todas las líneas del cliente y solo las suyas', async () => {
    const { vaciar, carrito } = montar([]);
    await agregar(carrito, CLIENTE, id(10), PUESTO_A.id, 1);
    await agregar(carrito, CLIENTE, id(11), PUESTO_A.id, 1);
    await agregar(carrito, OTRO, id(10), PUESTO_A.id, 4);
    await carrito.conUnidad(() => vaciar.ejecutar(CLIENTE));
    expect(await carrito.listar(CLIENTE)).toEqual([]);
    expect(await carrito.listar(OTRO)).toHaveLength(1);
  });

  it('rechaza un identificador de cliente inválido', async () => {
    const { vaciar, carrito } = montar([]);
    await expect(carrito.conUnidad(() => vaciar.ejecutar('abc'))).rejects.toBeInstanceOf(ErrorDeValidacion);
  });
});
