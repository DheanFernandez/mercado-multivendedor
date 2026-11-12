/**
 * T003 · Carrito participa en la unidad de trabajo (spec 003-pedidos-subpedidos; Q4, RF24; riesgos R2, R8).
 * El repositorio REAL del carrito, sobre un `PrismaService` real: `agregar` se une a la unidad; `bloquearYListar` toma
 * FOR UPDATE de la fila del carrito y de sus ítems (orden por producto) y `vaciarItems` borra dentro de la misma unidad.
 * Fuera de una unidad el comportamiento no cambia (lo comprueban las suites existentes del carrito).
 *
 * Solo el PostgreSQL local aislado; los datos llevan una etiqueta única y se eliminan al terminar.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaCarritoRepository } from '../src/modules/cart/infrastructure/prisma-carrito.repository.js';
import { UnidadDeTrabajoRequeridaError } from '../src/shared/domain/unidad-de-trabajo.error.js';
import { DatosCarrito } from './helpers/carrito-db.js';
import { abrirBase, etiqueta, Fixtures } from './helpers/inventario-db.js';
import { crearPrismaService } from './helpers/prisma-service-db.js';

const { prisma } = abrirBase();
const servicio = crearPrismaService('t003', 10);
const repo = new PrismaCarritoRepository(servicio);
const tag = etiqueta();
const datos = new DatosCarrito(prisma, new Fixtures(prisma, tag), tag);
const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const agregarCmd = (usuarioId: string, p: { productoId: string; puestoId: string }, cantidad = 1) => ({ usuarioId, productoId: p.productoId, puestoId: p.puestoId, cantidad, tope: 1000, maxItems: 50 });

beforeAll(async () => { await prisma.$connect(); });
afterAll(async () => {
  await datos.limpiar();
  await servicio.$disconnect();
  await prisma.$disconnect();
});

describe('agregar participa en la unidad de trabajo', () => {
  it('dentro de una unidad comparte la transacción (mismo xid) y no es visible desde fuera antes del COMMIT', async () => {
    const u = await datos.cliente();
    const p = await datos.producto();
    await servicio.unidadDeTrabajo(async () => {
      expect((await repo.agregar(agregarCmd(u, p, 2))).resultado).toBe('AGREGADO');
      const [m] = await servicio.db.$queryRaw<{ carrito: boolean; item: boolean }[]>`
        SELECT (SELECT c.xmin::text = (txid_current() % 4294967296)::text FROM carritos c WHERE c.usuario_id = ${u}::uuid) AS carrito,
               (SELECT bool_and(i.xmin::text = (txid_current() % 4294967296)::text) FROM carrito_items i JOIN carritos c ON c.id = i.carrito_id WHERE c.usuario_id = ${u}::uuid) AS item`;
      expect(m).toEqual({ carrito: true, item: true });
      expect(await datos.items(u)).toEqual([]); // otra conexión no ve nada sin confirmar
    });
    expect(await datos.items(u)).toEqual([{ productoId: p.productoId, cantidad: 2 }]);
  });

  it('si la unidad falla después de agregar, se revierte todo (incluida la creación del carrito)', async () => {
    const u = await datos.cliente();
    const p = await datos.producto();
    await expect(servicio.unidadDeTrabajo(async () => { await repo.agregar(agregarCmd(u, p)); throw new Error('fallo'); })).rejects.toThrow('fallo');
    expect(await datos.items(u)).toEqual([]);
    expect(await prisma.carrito.count({ where: { usuarioId: u } })).toBe(0);
  });
});

describe('bloquearYListar y vaciarItems', () => {
  it('exigen una unidad de trabajo vigente: fuera de ella fallan de inmediato', async () => {
    const u = await datos.cliente();
    await expect(repo.bloquearYListar(u)).rejects.toBeInstanceOf(UnidadDeTrabajoRequeridaError);
    await expect(repo.vaciarItems(u)).rejects.toBeInstanceOf(UnidadDeTrabajoRequeridaError);
  });

  it('un cliente sin carrito devuelve vacío y NO crea ninguna fila', async () => {
    const u = await datos.cliente();
    const r = await servicio.unidadDeTrabajo(() => repo.bloquearYListar(u));
    expect(r).toEqual({ carritoId: null, items: [] });
    expect(await prisma.carrito.count({ where: { usuarioId: u } })).toBe(0);
  });

  it('un carrito existente pero vacío devuelve su identificador y ninguna línea', async () => {
    const u = await datos.cliente();
    const p = await datos.producto();
    await repo.agregar(agregarCmd(u, p));
    await repo.quitar({ usuarioId: u, productoId: p.productoId });
    const r = await servicio.unidadDeTrabajo(() => repo.bloquearYListar(u));
    const fila = await prisma.carrito.findUniqueOrThrow({ where: { usuarioId: u } });
    expect(r).toEqual({ carritoId: fila.id, items: [] });
  });

  it('lista las líneas ordenadas por producto, con su puesto y cantidad, sea cual sea el orden de inserción', async () => {
    const u = await datos.cliente();
    const ps = (await Promise.all([datos.producto(), datos.producto(), datos.producto(), datos.producto()])).sort((x, y) => (x.productoId < y.productoId ? -1 : 1));
    // La cantidad crece con el orden del identificador y se inserta en orden inverso: ni el orden de inserción ni el de
    // cantidad (ascendente o descendente) coinciden con el orden por producto que debe devolver el repositorio.
    for (const i of [3, 1, 0, 2]) await repo.agregar(agregarCmd(u, ps[i]!, i + 1));
    const r = await servicio.unidadDeTrabajo(() => repo.bloquearYListar(u));
    const esperados = ps.map((p) => p.productoId);
    expect(r.items.map((i) => i.productoId)).toEqual(esperados);
    expect(r.items.map((i) => i.cantidad)).toEqual([1, 2, 3, 4]);
    for (const i of r.items) expect(i.puestoId).toBe(ps.find((p) => p.productoId === i.productoId)!.puestoId);
    expect(r.carritoId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('vaciarItems borra las líneas dentro de la unidad y se revierte con ella', async () => {
    const u = await datos.cliente();
    const [a, b] = await Promise.all([datos.producto(), datos.producto()]);
    await repo.agregar(agregarCmd(u, a));
    await repo.agregar(agregarCmd(u, b));
    await expect(servicio.unidadDeTrabajo(async () => {
      await repo.bloquearYListar(u);
      expect(await repo.vaciarItems(u)).toBe(2);
      throw new Error('fallo');
    })).rejects.toThrow('fallo');
    expect((await datos.items(u)).length).toBe(2); // revertido
    expect(await servicio.unidadDeTrabajo(async () => { await repo.bloquearYListar(u); return repo.vaciarItems(u); })).toBe(2);
    expect(await datos.items(u)).toEqual([]);
    expect(await prisma.carrito.count({ where: { usuarioId: u } })).toBe(1); // el carrito sigue existiendo
  });
});

describe('el bloqueo retiene las ediciones concurrentes hasta el COMMIT (R8)', () => {
  it('agregar, fijarCantidad y quitar esperan a que termine la unidad y luego se aplican sobre el estado confirmado', async () => {
    const u = await datos.cliente();
    const [p1, p2, p3] = await Promise.all([datos.producto(), datos.producto(), datos.producto()]);
    await repo.agregar(agregarCmd(u, p1, 2));
    await repo.agregar(agregarCmd(u, p2, 1));

    let arrancaron!: () => void;
    const listos = new Promise<void>((r) => (arrancaron = r));
    let finCallback = 0;
    const unidad = servicio.unidadDeTrabajo(async () => {
      const r = await repo.bloquearYListar(u);
      arrancaron();
      await dormir(400); // retiene los bloqueos
      await repo.vaciarItems(u);
      finCallback = performance.now();
      return r;
    });
    await listos;

    const t: Record<string, number> = {};
    const ops = {
      agregar: repo.agregar(agregarCmd(u, p3, 4)).then((r) => { t['agregar'] = performance.now(); return r; }),
      fijar: repo.fijarCantidad({ usuarioId: u, productoId: p1.productoId, cantidad: 9 }).then((r) => { t['fijar'] = performance.now(); return r; }),
      quitar: repo.quitar({ usuarioId: u, productoId: p2.productoId }).then((r) => { t['quitar'] = performance.now(); return r; }),
    };
    await dormir(150); // a mitad de la retención: ninguna ha terminado
    expect(Object.keys(t)).toEqual([]);

    const leidas = await unidad;
    const [ra, rf, rq] = await Promise.all([ops.agregar, ops.fijar, ops.quitar]);
    // Terminaron DESPUÉS de que la unidad soltó sus bloqueos.
    for (const [nombre, tiempo] of Object.entries(t)) expect(tiempo, nombre).toBeGreaterThanOrEqual(finCallback);
    // La unidad vio el estado confirmado anterior; las ediciones se aplicaron después sobre el carrito ya vaciado.
    expect(leidas.items.map((i) => [i.productoId, i.cantidad]).sort()).toEqual([[p1.productoId, 2], [p2.productoId, 1]].sort());
    expect(ra.resultado).toBe('AGREGADO'); // la línea nueva NO se perdió
    expect(rf).toBe(false); // su línea ya no existe (R8: «no está en el carrito»)
    expect(rq).toBe(false);
    expect(await datos.items(u)).toEqual([{ productoId: p3.productoId, cantidad: 4 }]);
  });

  it('una edición terminada ANTES del bloqueo entra en la lectura de la unidad', async () => {
    const u = await datos.cliente();
    const [p1, p2] = await Promise.all([datos.producto(), datos.producto()]);
    await repo.agregar(agregarCmd(u, p1, 1));
    await repo.agregar(agregarCmd(u, p2, 3));
    const r = await servicio.unidadDeTrabajo(() => repo.bloquearYListar(u));
    expect(r.items.map((i) => i.cantidad).sort()).toEqual([1, 3]);
  });

  it('sin interbloqueos: 30 unidades y 90 ediciones concurrentes sobre los mismos carritos terminan sin error', async () => {
    const clientes = await Promise.all([datos.cliente(), datos.cliente(), datos.cliente()]);
    const ps = await Promise.all([datos.producto(), datos.producto(), datos.producto()]);
    for (const c of clientes) for (const p of ps) await repo.agregar(agregarCmd(c, p, 2));
    const tareas: Promise<unknown>[] = [];
    for (let i = 0; i < 30; i++) {
      const c = clientes[i % 3]!;
      const p = ps[i % 3]!;
      tareas.push(servicio.unidadDeTrabajo(async () => { await repo.bloquearYListar(c); await dormir(i % 5); if (i % 3 === 0) await repo.vaciarItems(c); }));
      tareas.push(repo.agregar(agregarCmd(c, p, 1)));
      tareas.push(repo.fijarCantidad({ usuarioId: c, productoId: p.productoId, cantidad: 3 }));
      tareas.push(repo.quitar({ usuarioId: c, productoId: ps[(i + 1) % 3]!.productoId }));
    }
    const resultados = await Promise.allSettled(tareas);
    expect(resultados.filter((r) => r.status === 'rejected').map((r) => String((r as PromiseRejectedResult).reason))).toEqual([]);
  });
});
