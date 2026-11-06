/**
 * Carrito contra PostgreSQL local de Docker (npm run test:db): restricciones del modelo, suma atómica y concurrencia
 * (RF15, RF20–RF24; AC07, AC08). Nunca se ejecuta contra una base remota.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConsultarCarrito, AgregarAlCarrito, ActualizarCantidadCarrito } from '../src/modules/cart/application/use-cases/carrito.use-cases.js';
import type { DisponibilidadPort, ProductoVendiblePort } from '../src/modules/cart/application/ports/ports.js';
import { StockInsuficienteCarritoError } from '../src/modules/cart/domain/errors.js';
import { PrismaCarritoRepository } from '../src/modules/cart/infrastructure/prisma-carrito.repository.js';
import type { Actor } from '../src/shared/domain/actor.js';
import type { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { abrirBase, etiqueta, Fixtures, intentar } from './helpers/inventario-db.js';

const { prisma, repo: inventario } = abrirBase(20);
const tag = etiqueta();
const fx = new Fixtures(prisma, tag);
const carritoRepo = new PrismaCarritoRepository(prisma as unknown as PrismaService);
const clientes: string[] = [];
let contador = 0;

/** Productos desde la base y disponibilidad desde el repositorio real de inventario (como los adaptadores de producción). */
const productos: ProductoVendiblePort = {
  async obtener(id) {
    const p = await prisma.producto.findUnique({ where: { id }, include: { puesto: true } });
    return p ? { productoId: p.id, nombre: p.nombre, unidadVenta: p.unidadVenta, presentacion: p.presentacion, precioCentimos: Math.round(Number(p.precio) * 100), puesto: { id: p.puesto.id, codigo: p.puesto.codigo, nombre: p.puesto.nombre } } : null;
  },
};
const disponibilidad: DisponibilidadPort = { async disponible(id) { return (await inventario.obtener(id))?.stockDisponible ?? 0; } };
const d = { carrito: carritoRepo, productos, inventario: disponibilidad };
const consultar = new ConsultarCarrito(d);
const agregar = new AgregarAlCarrito(d, consultar);
const actualizar = new ActualizarCantidadCarrito(d, consultar);

async function nuevoCliente(): Promise<Actor> {
  const u = await prisma.usuario.create({ data: { email: `${tag}-c${++contador}@prueba.test`, nombres: 'C', apellidos: 'L', rol: 'CLIENTE' } });
  clientes.push(u.id);
  return { id: u.id, rol: 'CLIENTE' };
}

beforeAll(async () => { await prisma.$connect(); });
afterAll(async () => {
  await prisma.carrito.deleteMany({ where: { usuarioId: { in: clientes } } });
  await fx.limpiar();
  await prisma.usuario.deleteMany({ where: { id: { in: clientes } } });
  await prisma.$disconnect();
});

describe('restricciones del modelo (AC08)', () => {
  it('la base rechaza cantidades fuera de 1–10000, ítems duplicados y un puesto distinto al del producto', async () => {
    const cliente = await nuevoCliente();
    const a = await fx.productoConStock(5);
    const otro = await fx.puesto();
    const carrito = await prisma.carrito.create({ data: { usuarioId: cliente.id } });
    const item = (cantidad: number, puestoId = a.puestoId) => prisma.carritoItem.create({ data: { carritoId: carrito.id, productoId: a.productoId, puestoId, cantidad } });
    expect((await intentar(() => item(0))).ok).toBe(false);
    expect((await intentar(() => item(-1))).ok).toBe(false);
    expect((await intentar(() => item(10_001))).ok).toBe(false);
    expect((await intentar(() => item(1, otro.puestoId))).ok).toBe(false);
    expect((await intentar(() => item(2))).ok).toBe(true);
    expect((await intentar(() => item(2))).ok).toBe(false); // (carrito, producto) único
    expect((await intentar(() => prisma.carrito.create({ data: { usuarioId: cliente.id } }))).ok).toBe(false); // un carrito por cliente
  });
});

describe('agregar, actualizar y quitar sobre PostgreSQL', () => {
  it('productos de tres puestos: subtotales por puesto y total exactos', async () => {
    const cliente = await nuevoCliente();
    const p1 = await fx.productoConStock(10);
    const p2 = await fx.productoConStock(10);
    const p3 = await fx.productoConStock(10);
    await prisma.producto.update({ where: { id: p1.productoId }, data: { precio: '6.50', estado: 'PUBLICADO' } });
    await prisma.producto.update({ where: { id: p2.productoId }, data: { precio: '0.10' } });
    await prisma.producto.update({ where: { id: p3.productoId }, data: { precio: '19.99' } });
    await agregar.ejecutar(cliente, { productoId: p1.productoId, cantidad: 3 });
    await agregar.ejecutar(cliente, { productoId: p2.productoId, cantidad: 3 });
    const c = await agregar.ejecutar(cliente, { productoId: p3.productoId, cantidad: 3 });
    expect(c.puestos.map((g) => g.subtotal).sort()).toEqual(['0.30', '19.50', '59.97']);
    expect(c.total).toBe('79.77');
    const mas = await actualizar.ejecutar(cliente, p1.productoId, { cantidad: 10 });
    expect(mas.total).toBe('125.27');
  });

  it('sumar al mismo producto acumula y respeta el stock', async () => {
    const cliente = await nuevoCliente();
    const { productoId } = await fx.productoConStock(5);
    await agregar.ejecutar(cliente, { productoId, cantidad: 2 });
    await agregar.ejecutar(cliente, { productoId, cantidad: 3 });
    await expect(agregar.ejecutar(cliente, { productoId, cantidad: 1 })).rejects.toThrow(StockInsuficienteCarritoError);
    const filas = await prisma.carritoItem.findMany({ where: { carrito: { usuarioId: cliente.id } } });
    expect(filas.map((f) => f.cantidad)).toEqual([5]);
  });

  it('quitar y vaciar eliminan filas y no afectan al carrito de otro cliente', async () => {
    const a = await nuevoCliente();
    const b = await nuevoCliente();
    const { productoId } = await fx.productoConStock(5);
    await agregar.ejecutar(a, { productoId, cantidad: 1 });
    await agregar.ejecutar(b, { productoId, cantidad: 2 });
    expect(await carritoRepo.quitar({ usuarioId: a.id, productoId })).toBe(true);
    expect(await carritoRepo.quitar({ usuarioId: a.id, productoId })).toBe(false);
    expect(await carritoRepo.listar(b.id)).toHaveLength(1);
    await carritoRepo.vaciar(b.id);
    expect(await carritoRepo.listar(b.id)).toEqual([]);
  });
});

describe('concurrencia (RF15 · AC07)', () => {
  it('40 solicitudes simultáneas del mismo cliente por 1 unidad con stock 12: exactamente 12 entran y nunca se supera el stock', async () => {
    const cliente = await nuevoCliente();
    const { productoId } = await fx.productoConStock(12);
    const rs = await Promise.all(Array.from({ length: 40 }, () => intentar(() => agregar.ejecutar(cliente, { productoId, cantidad: 1 }))));
    expect(rs.filter((r) => r.ok)).toHaveLength(12);
    const fallos = rs.filter((r) => !r.ok) as { ok: false; error: unknown }[];
    expect(fallos).toHaveLength(28);
    expect(fallos.every((f) => f.error instanceof StockInsuficienteCarritoError)).toBe(true);
    const filas = await prisma.carritoItem.findMany({ where: { carrito: { usuarioId: cliente.id } } });
    expect(filas).toHaveLength(1);
    expect(filas[0]!.cantidad).toBe(12);
  });

  it('solicitudes simultáneas de un carrito nuevo crean un único carrito y no pierden ninguna suma', async () => {
    const cliente = await nuevoCliente();
    const prods = await Promise.all(Array.from({ length: 5 }, () => fx.productoConStock(100)));
    const rs = await Promise.all(prods.flatMap((p) => Array.from({ length: 4 }, () => intentar(() => agregar.ejecutar(cliente, { productoId: p.productoId, cantidad: 2 })))));
    expect(rs.every((r) => r.ok)).toBe(true);
    expect(await prisma.carrito.count({ where: { usuarioId: cliente.id } })).toBe(1);
    const filas = await prisma.carritoItem.findMany({ where: { carrito: { usuarioId: cliente.id } } });
    expect(filas).toHaveLength(5);
    expect(filas.every((f) => f.cantidad === 8)).toBe(true);
  });

  it('muchos clientes compiten por el último producto: cada carrito puede tenerlo (la reserva real ocurre al pedir), sin errores inesperados', async () => {
    const { productoId } = await fx.productoConStock(1);
    const cs = await Promise.all(Array.from({ length: 15 }, () => nuevoCliente()));
    const rs = await Promise.all(cs.map((c) => intentar(() => agregar.ejecutar(c, { productoId, cantidad: 1 }))));
    expect(rs.every((r) => r.ok)).toBe(true);
    expect(await prisma.carritoItem.count({ where: { productoId } })).toBe(15);
    // El stock no se toca al agregar al carrito: sigue habiendo 1 disponible y 0 reservado.
    expect(await inventario.obtener(productoId)).toMatchObject({ stockFisico: 1, stockReservado: 0, stockDisponible: 1 });
  });

  it('un tope de 50 productos distintos se respeta aun con solicitudes simultáneas', async () => {
    const cliente = await nuevoCliente();
    const prods = await Promise.all(Array.from({ length: 56 }, () => fx.productoConStock(5)));
    const rs = await Promise.all(prods.map((p) => intentar(() => agregar.ejecutar(cliente, { productoId: p.productoId, cantidad: 1 }))));
    expect(rs.filter((r) => r.ok)).toHaveLength(50);
    expect(await prisma.carritoItem.count({ where: { carrito: { usuarioId: cliente.id } } })).toBe(50);
  });
});
