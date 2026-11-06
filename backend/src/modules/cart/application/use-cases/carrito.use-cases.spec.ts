import { beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '../../../../shared/domain/actor.js';
import { ErrorDeValidacion, ErrorProhibido } from '../../../../shared/domain/errors.js';
import { MAX_ITEMS_CARRITO } from '../../domain/calculo.js';
import { ItemNoEncontradoError, LimiteItemsCarritoError, ProductoNoDisponibleError, StockInsuficienteCarritoError } from '../../domain/errors.js';
import {
  ActualizarCantidadCarrito,
  AgregarAlCarrito,
  ConsultarCarrito,
  QuitarDelCarrito,
  VaciarCarrito,
  type DependenciasCarrito,
} from './carrito.use-cases.js';
import { CarritoEnMemoria, DisponibilidadFalsa, ProductosVendiblesFalsos } from './test-doubles.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CLIENTE: Actor = { id: id(1), rol: 'CLIENTE' };
const OTRO: Actor = { id: id(2), rol: 'CLIENTE' };
const PUESTO_A = { id: id(301), codigo: 'A-1', nombre: 'Puesto A' };
const PUESTO_B = { id: id(302), codigo: 'B-1', nombre: 'Puesto B' };
const MANGO = id(501); // puesto A, 6.50
const PAPA = id(502);  // puesto B, 2.25
const PALTA = id(503); // puesto B, 12.00

let carrito: CarritoEnMemoria;
let inventario: DisponibilidadFalsa;
let productos: ProductosVendiblesFalsos;
let consultar: ConsultarCarrito;
let agregar: AgregarAlCarrito;
let actualizar: ActualizarCantidadCarrito;
let quitar: QuitarDelCarrito;
let vaciar: VaciarCarrito;

const vendible = (pid: string, nombre: string, precioCentimos: number, puesto: typeof PUESTO_A) => ({ productoId: pid, nombre, unidadVenta: 'KILOGRAMO', presentacion: null, precioCentimos, puesto });

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

describe('permisos', () => {
  it('solo el cliente usa el carrito: comerciante, trabajador y administrador reciben ErrorProhibido', async () => {
    for (const rol of ['COMERCIANTE', 'TRABAJADOR_PUESTO', 'ADMINISTRADOR'] as const) {
      const actor: Actor = { id: id(9), rol };
      await expect(consultar.ejecutar(actor)).rejects.toThrow(ErrorProhibido);
      await expect(agregar.ejecutar(actor, { productoId: MANGO, cantidad: 1 })).rejects.toThrow(ErrorProhibido);
      await expect(actualizar.ejecutar(actor, MANGO, { cantidad: 1 })).rejects.toThrow(ErrorProhibido);
      await expect(quitar.ejecutar(actor, MANGO)).rejects.toThrow(ErrorProhibido);
      await expect(vaciar.ejecutar(actor)).rejects.toThrow(ErrorProhibido);
    }
  });

  it('cada cliente ve solo su carrito (aislamiento)', async () => {
    await agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 2 });
    expect((await consultar.ejecutar(OTRO)).puestos).toEqual([]);
    await expect(quitar.ejecutar(OTRO, MANGO)).rejects.toThrow(ItemNoEncontradoError);
    await expect(actualizar.ejecutar(OTRO, MANGO, { cantidad: 1 })).rejects.toThrow(ItemNoEncontradoError);
    expect((await consultar.ejecutar(CLIENTE)).totalProductos).toBe(2);
  });
});

describe('agregar (RF20, RF21, RF15)', () => {
  it('productos de distintos puestos en el mismo carrito, con puesto identificado, subtotales y total', async () => {
    await agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 3 });
    const c = await agregar.ejecutar(CLIENTE, { productoId: PAPA, cantidad: 4 });
    expect(c.puestos.map((g) => [g.puesto.codigo, g.subtotal])).toEqual([['A-1', '19.50'], ['B-1', '9.00']]);
    expect(c.total).toBe('28.50');
    expect(c.requiereRevision).toBe(false);
  });

  it('agregar el mismo producto suma la cantidad', async () => {
    await agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 3 });
    const c = await agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 2 });
    expect(c.puestos[0]!.items).toHaveLength(1);
    expect(c.puestos[0]!.items[0]).toMatchObject({ cantidad: 5, subtotal: '32.50' });
  });

  it('stock insuficiente: 409 con las unidades disponibles y el carrito no cambia', async () => {
    await expect(agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 11 })).rejects.toThrow(StockInsuficienteCarritoError);
    await agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 8 });
    const e = await agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 3 }).catch((x) => x);
    expect(e).toBeInstanceOf(StockInsuficienteCarritoError);
    expect(e.disponible).toBe(10);
    expect((await consultar.ejecutar(CLIENTE)).puestos[0]!.items[0]!.cantidad).toBe(8);
  });

  it('producto sin existencias registradas o agotado: no se puede agregar', async () => {
    await expect(agregar.ejecutar(CLIENTE, { productoId: PALTA, cantidad: 1 })).rejects.toThrow(StockInsuficienteCarritoError);
  });

  it('producto no disponible (inexistente, despublicado, puesto o categoría inactivos): ProductoNoDisponible', async () => {
    await expect(agregar.ejecutar(CLIENTE, { productoId: id(999), cantidad: 1 })).rejects.toThrow(ProductoNoDisponibleError);
  });

  it('entradas inválidas: 400', async () => {
    for (const c of [{}, { productoId: 'x', cantidad: 1 }, { productoId: MANGO }, { productoId: MANGO, cantidad: 0 }, { productoId: MANGO, cantidad: -2 }, { productoId: MANGO, cantidad: 1.5 }, { productoId: MANGO, cantidad: '2' }, { productoId: MANGO, cantidad: 10_001 }]) {
      await expect(agregar.ejecutar(CLIENTE, c)).rejects.toThrow(ErrorDeValidacion);
    }
    expect((await consultar.ejecutar(CLIENTE)).puestos).toEqual([]);
  });

  it(`límite de ${MAX_ITEMS_CARRITO} productos distintos; sumar a uno existente sigue permitido`, async () => {
    for (let i = 0; i < MAX_ITEMS_CARRITO; i++) {
      const pid = id(1000 + i);
      productos.productos[pid] = vendible(pid, `P${i}`, 100, PUESTO_A);
      inventario.unidades[pid] = 5;
      await agregar.ejecutar(CLIENTE, { productoId: pid, cantidad: 1 });
    }
    await expect(agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 1 })).rejects.toThrow(LimiteItemsCarritoError);
    await expect(agregar.ejecutar(CLIENTE, { productoId: id(1000), cantidad: 1 })).resolves.toBeDefined();
  });

  it('solicitudes simultáneas del mismo cliente no superan el stock disponible', async () => {
    const r = await Promise.allSettled(Array.from({ length: 20 }, () => agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 1 })));
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(10);
    expect(r.filter((x) => x.status === 'rejected').every((x) => (x as PromiseRejectedResult).reason instanceof StockInsuficienteCarritoError)).toBe(true);
    expect((await consultar.ejecutar(CLIENTE)).puestos[0]!.items[0]!.cantidad).toBe(10);
  });
});

describe('modificar y quitar (RF24, HU05)', () => {
  beforeEach(async () => {
    await agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 3 });
    await agregar.ejecutar(CLIENTE, { productoId: PAPA, cantidad: 2 });
  });

  it('actualiza la cantidad y recalcula subtotales y total', async () => {
    const c = await actualizar.ejecutar(CLIENTE, MANGO, { cantidad: 10 });
    expect(c.puestos[0]).toMatchObject({ subtotal: '65.00' });
    expect(c.total).toBe('69.50');
  });

  it('actualizar por encima del stock: 409 y la cantidad previa se conserva', async () => {
    await expect(actualizar.ejecutar(CLIENTE, MANGO, { cantidad: 11 })).rejects.toThrow(StockInsuficienteCarritoError);
    expect((await consultar.ejecutar(CLIENTE)).puestos[0]!.items[0]!.cantidad).toBe(3);
  });

  it('actualizar un producto que no está en el carrito: 404; cantidad inválida: 400', async () => {
    await expect(actualizar.ejecutar(CLIENTE, PALTA, { cantidad: 1 })).rejects.toThrow(ItemNoEncontradoError);
    await expect(actualizar.ejecutar(CLIENTE, MANGO, { cantidad: 0 })).rejects.toThrow(ErrorDeValidacion);
    await expect(actualizar.ejecutar(CLIENTE, 'no-uuid', { cantidad: 1 })).rejects.toThrow(ErrorDeValidacion);
  });

  it('quita un producto; el puesto sin productos desaparece; quitarlo otra vez da 404', async () => {
    const c = await quitar.ejecutar(CLIENTE, MANGO);
    expect(c.puestos.map((g) => g.puesto.codigo)).toEqual(['B-1']);
    expect(c.total).toBe('4.50');
    await expect(quitar.ejecutar(CLIENTE, MANGO)).rejects.toThrow(ItemNoEncontradoError);
  });

  it('vaciar deja el carrito en cero', async () => {
    expect(await vaciar.ejecutar(CLIENTE)).toEqual({ puestos: [], total: '0.00', totalProductos: 0, requiereRevision: false });
    expect((await consultar.ejecutar(CLIENTE)).puestos).toEqual([]);
  });
});

describe('cambios posteriores en productos e inventario', () => {
  beforeEach(async () => {
    await agregar.ejecutar(CLIENTE, { productoId: MANGO, cantidad: 4 });
    await agregar.ejecutar(CLIENTE, { productoId: PAPA, cantidad: 2 });
  });

  it('el precio se lee vigente: un cambio de precio se refleja sin tocar el carrito', async () => {
    productos.productos[MANGO] = vendible(MANGO, 'Mango', 700, PUESTO_A);
    expect((await consultar.ejecutar(CLIENTE)).total).toBe('32.50'); // 4 × 7.00 + 2 × 2.25
  });

  it('si el stock baja de lo pedido, la línea se marca STOCK_INSUFICIENTE y no suma', async () => {
    inventario.unidades[MANGO] = 2;
    const c = await consultar.ejecutar(CLIENTE);
    expect(c.puestos[0]!.items[0]).toMatchObject({ estado: 'STOCK_INSUFICIENTE', disponible: 2 });
    expect(c.total).toBe('4.50');
    expect(c.requiereRevision).toBe(true);
    const corregido = await actualizar.ejecutar(CLIENTE, MANGO, { cantidad: 2 });
    expect(corregido.requiereRevision).toBe(false);
    expect(corregido.total).toBe('17.50');
  });

  it('un producto despublicado se marca NO_DISPONIBLE, no suma, no se puede subir su cantidad pero sí quitar', async () => {
    delete productos.productos[PAPA];
    const c = await consultar.ejecutar(CLIENTE);
    expect(c.puestos.find((g) => g.puesto.id === PUESTO_B.id)!.items[0]).toMatchObject({ estado: 'NO_DISPONIBLE', precioUnitario: null });
    expect(c.total).toBe('26.00');
    expect(c.requiereRevision).toBe(true);
    await expect(actualizar.ejecutar(CLIENTE, PAPA, { cantidad: 3 })).rejects.toThrow(ProductoNoDisponibleError);
    await expect(agregar.ejecutar(CLIENTE, { productoId: PAPA, cantidad: 1 })).rejects.toThrow(ProductoNoDisponibleError);
    const sin = await quitar.ejecutar(CLIENTE, PAPA);
    expect(sin.requiereRevision).toBe(false);
  });
});
