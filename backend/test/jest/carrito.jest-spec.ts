/**
 * Suite representativa con Jest (spec 006): casos de uso del carrito (RF20–RF24; HU04–HU06) con los dobles en memoria.
 * Sin red, PostgreSQL ni Supabase.
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Actor } from '../../src/shared/domain/actor.js';
import { ErrorDeValidacion, ErrorProhibido } from '../../src/shared/domain/errors.js';
import { MAX_ITEMS_CARRITO } from '../../src/modules/cart/domain/calculo.js';
import { ItemNoEncontradoError, LimiteItemsCarritoError, ProductoNoDisponibleError, StockInsuficienteCarritoError } from '../../src/modules/cart/domain/errors.js';
import type { ProductoVendible } from '../../src/modules/cart/application/ports/ports.js';
import {
  ActualizarCantidadCarrito,
  AgregarAlCarrito,
  ConsultarCarrito,
  QuitarDelCarrito,
  VaciarCarrito,
  type DependenciasCarrito,
} from '../../src/modules/cart/application/use-cases/carrito.use-cases.js';
import { CarritoEnMemoria, DisponibilidadFalsa, ProductosVendiblesFalsos } from '../../src/modules/cart/application/use-cases/test-doubles.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CLIENTE: Actor = { id: id(1), rol: 'CLIENTE' };
const OTRO: Actor = { id: id(2), rol: 'CLIENTE' };
const PUESTO_A = { id: id(301), codigo: 'A-1', nombre: 'Puesto A' };
const PUESTO_B = { id: id(302), codigo: 'B-1', nombre: 'Puesto B' };
const MANGO = id(501);
const PAPA = id(502);
const PALTA = id(503);
const vendible = (productoId: string, nombre: string, precioCentimos: number, puesto: typeof PUESTO_A): ProductoVendible => ({ productoId, nombre, unidadVenta: 'KILOGRAMO', presentacion: null, precioCentimos, puesto });

let carrito: CarritoEnMemoria;
let inventario: DisponibilidadFalsa;
let productos: ProductosVendiblesFalsos;
let consultar: ConsultarCarrito;
let agregar: AgregarAlCarrito;
let actualizar: ActualizarCantidadCarrito;
let quitar: QuitarDelCarrito;
let vaciar: VaciarCarrito;

beforeEach(() => {
  carrito = new CarritoEnMemoria();
  inventario = new DisponibilidadFalsa({ [MANGO]: 10, [PAPA]: 20, [PALTA]: 0 });
  productos = new ProductosVendiblesFalsos({
    [MANGO]: vendible(MANGO, 'Mango', 650, PUESTO_A),
    [PAPA]: vendible(PAPA, 'Papa', 225, PUESTO_B),
    [PALTA]: vendible(PALTA, 'Palta', 1200, PUESTO_B),
  });
  const d: DependenciasCarrito = { carrito, productos, inventario };
  consultar = new ConsultarCarrito(d);
  agregar = new AgregarAlCarrito(d, consultar);
  actualizar = new ActualizarCantidadCarrito(d, consultar);
  quitar = new QuitarDelCarrito(d, consultar);
  vaciar = new VaciarCarrito(d);
});

describe('Carrito · autorización y entrada', () => {
  it('solo el rol CLIENTE usa el carrito', async () => {
    for (const rol of ['COMERCIANTE', 'TRABAJADOR_PUESTO', 'ADMINISTRADOR'] as const) {
      await expect(consultar.ejecutar({ id: id(9), rol })).rejects.toThrow(ErrorProhibido);
    }
    await expect(agregar.ejecutar({ id: id(9), rol: 'COMERCIANTE' }, { productoId: MANGO, cantidad: 1 })).rejects.toThrow(ErrorProhibido);
  });

  it('valida el identificador y la cantidad antes de tocar nada', async () => {
    await expect(agregar.ejecutar(CLIENTE, { productoId: 'no-es-uuid', cantidad: 1 })).rejects.toThrow(ErrorDeValidacion);
    await expect(agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 0 })).rejects.toThrow(ErrorDeValidacion);
    await expect(agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 1.5 })).rejects.toThrow(ErrorDeValidacion);
    expect((await consultar.ejecutar(CLIENTE)).totalProductos).toBe(0);
  });
});

describe('Carrito · agregar (RF20, RF21)', () => {
  it('reúne productos de varios puestos, con subtotales y total exactos', async () => {
    await agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 3 });
    const r = await agregar.ejecutar(CLIENTE, { productoId: PAPA, cantidad: 4 });
    expect(r.puestos.map((g) => g.puesto.codigo).sort((a, b) => a.localeCompare(b))).toEqual(['A-1', 'B-1']);
    expect(r.puestos.find((g) => g.puesto.codigo === 'A-1')?.subtotal).toBe('19.50');
    expect(r.puestos.find((g) => g.puesto.codigo === 'B-1')?.subtotal).toBe('9.00');
    expect(r).toMatchObject({ total: '28.50', totalProductos: 7, requiereRevision: false });
  });

  it('agregar de nuevo el mismo producto suma en una sola línea', async () => {
    await agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 2 });
    const r = await agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 3 });
    expect(r.puestos).toHaveLength(1);
    expect(r.puestos[0]?.items).toHaveLength(1);
    expect(r.puestos[0]?.items[0]).toMatchObject({ cantidad: 5, subtotal: '32.50' });
  });

  it('no supera el disponible, ni siquiera sumando en pasos', async () => {
    await agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 8 });
    await expect(agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 3 })).rejects.toThrow(StockInsuficienteCarritoError);
    expect((await consultar.ejecutar(CLIENTE)).puestos[0]?.items[0]?.cantidad).toBe(8);
    await expect(agregar.ejecutar(CLIENTE, { productoId: PALTA, cantidad: 1 })).rejects.toThrow(StockInsuficienteCarritoError);
  });

  it('un producto no comprable responde como no disponible', async () => {
    await expect(agregar.ejecutar(CLIENTE, { productoId: id(999), cantidad: 1 })).rejects.toThrow(ProductoNoDisponibleError);
  });

  it(`admite como máximo ${MAX_ITEMS_CARRITO} productos distintos`, async () => {
    const lote: Record<string, ProductoVendible> = {};
    const stock: Record<string, number> = {};
    for (let i = 0; i < MAX_ITEMS_CARRITO + 1; i++) {
      const pid = id(1000 + i);
      lote[pid] = vendible(pid, `P${i}`, 100, PUESTO_A);
      stock[pid] = 5;
    }
    const d: DependenciasCarrito = { carrito: new CarritoEnMemoria(), productos: new ProductosVendiblesFalsos(lote), inventario: new DisponibilidadFalsa(stock) };
    const c = new ConsultarCarrito(d);
    const a = new AgregarAlCarrito(d, c);
    for (let i = 0; i < MAX_ITEMS_CARRITO; i++) await a.ejecutar(CLIENTE, { productoId: id(1000 + i), cantidad: 1 });
    await expect(a.ejecutar(CLIENTE, { productoId: id(1000 + MAX_ITEMS_CARRITO), cantidad: 1 })).rejects.toThrow(LimiteItemsCarritoError);
    // un producto que ya está sigue pudiendo sumarse
    await expect(a.ejecutar(CLIENTE, { productoId: id(1000), cantidad: 1 })).resolves.toBeDefined();
  });

  it('cada cliente ve solo su carrito', async () => {
    await agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 1 });
    expect((await consultar.ejecutar(OTRO)).totalProductos).toBe(0);
  });
});

describe('Carrito · cambiar, quitar y vaciar (RF24)', () => {
  it('fija la cantidad de un producto del carrito dentro del disponible', async () => {
    await agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 2 });
    const r = await actualizar.ejecutar(CLIENTE, MANGO, { cantidad: 7 });
    expect(r.puestos[0]?.items[0]?.cantidad).toBe(7);
    await expect(actualizar.ejecutar(CLIENTE, MANGO, { cantidad: 11 })).rejects.toThrow(StockInsuficienteCarritoError);
  });

  it('cambiar o quitar lo que no está en el carrito da «no encontrado»', async () => {
    await expect(actualizar.ejecutar(CLIENTE, MANGO, { cantidad: 1 })).rejects.toThrow(ItemNoEncontradoError);
    await expect(quitar.ejecutar(CLIENTE, MANGO)).rejects.toThrow(ItemNoEncontradoError);
  });

  it('un producto que dejó de venderse no se puede actualizar, pero sí quitar', async () => {
    await agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 2 });
    delete productos.productos[MANGO];
    await expect(actualizar.ejecutar(CLIENTE, MANGO, { cantidad: 1 })).rejects.toThrow(ProductoNoDisponibleError);
    const r = await consultar.ejecutar(CLIENTE);
    expect(r).toMatchObject({ requiereRevision: true, total: '0.00' });
    expect((await quitar.ejecutar(CLIENTE, MANGO)).puestos).toHaveLength(0);
  });

  it('vaciar deja un carrito vacío y no afecta a otros clientes', async () => {
    await agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 2 });
    await agregar.ejecutar(OTRO, { productoId: PAPA, cantidad: 1 });
    expect(await vaciar.ejecutar(CLIENTE)).toEqual({ puestos: [], total: '0.00', totalProductos: 0, requiereRevision: false });
    expect((await consultar.ejecutar(CLIENTE)).totalProductos).toBe(0);
    expect((await consultar.ejecutar(OTRO)).totalProductos).toBe(1);
  });

  it('el stock que baja después marca la línea para revisión sin sumarla', async () => {
    await agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 6 });
    inventario.unidades[MANGO] = 2;
    const r = await consultar.ejecutar(CLIENTE);
    expect(r.puestos[0]?.items[0]).toMatchObject({ estado: 'STOCK_INSUFICIENTE', disponible: 2 });
    expect(r).toMatchObject({ total: '0.00', requiereRevision: true });
  });
});
