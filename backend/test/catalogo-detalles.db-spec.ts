/**
 * T004 · Catálogo en lote y por la conexión activa (spec 003-pedidos-subpedidos; RF19, DA11).
 * `detalles(ids)` devuelve en UNA operación los productos que el catálogo expone (publicados, con categoría, puesto y
 * comerciante activos) y usa la transacción de la unidad de trabajo si la hay (sin abrir una segunda conexión).
 * Fuera de una unidad se comporta como el resto del repositorio (cliente simple o servicio, sin cambios).
 *
 * Solo el PostgreSQL local aislado; los datos llevan una etiqueta única y se eliminan al terminar.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exigirBaseAislada } from '../scripts/base-aislada.mjs';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { ObtenerDetallesCatalogo } from '../src/modules/catalog/application/use-cases/catalogo.use-cases.js';
import { PrismaCatalogoRepository } from '../src/modules/catalog/infrastructure/prisma-catalogo.repository.js';
import { ClienteBaseEnUnidadError } from '../src/shared/infrastructure/prisma/contexto-transaccional.js';
import type { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { DatosCarrito } from './helpers/carrito-db.js';
import { abrirBase, etiqueta, Fixtures } from './helpers/inventario-db.js';
import { crearPrismaService } from './helpers/prisma-service-db.js';

const { prisma } = abrirBase(); // cliente simple convertido a PrismaService, como hacen los repositorios en las pruebas existentes
const repoSimple = new PrismaCatalogoRepository(prisma as unknown as PrismaService);
const servicio = crearPrismaService('t004', 10);
const repoServicio = new PrismaCatalogoRepository(servicio);
const tag = etiqueta();
const datos = new DatosCarrito(prisma, new Fixtures(prisma, tag), tag);
const categoriasExtra: string[] = [];

const normalizar = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => (a.id < b.id ? -1 : 1));

beforeAll(async () => { await prisma.$connect(); });
afterAll(async () => {
  await datos.limpiar();
  await prisma.categoria.deleteMany({ where: { id: { in: categoriasExtra } } });
  await servicio.$disconnect();
  await prisma.$disconnect();
});

describe('detalles(ids): visibilidad y equivalencia con detalle(id)', () => {
  it('devuelve solo lo que el catálogo expone y cada elemento es idéntico al de `detalle(id)`', async () => {
    const visible1 = await datos.producto(true, '6.50');
    const visible2 = await datos.producto(true, '19.99');
    const borrador = await datos.producto(false);
    const desactivado = await datos.producto(true);
    await prisma.producto.update({ where: { id: desactivado.productoId }, data: { estado: 'DESACTIVADO' } });
    const puestoInactivo = await datos.producto(true);
    await prisma.puesto.update({ where: { id: puestoInactivo.puestoId }, data: { estado: 'INACTIVO' } });
    const comercianteSuspendido = await datos.producto(true);
    const pu = await prisma.puesto.findUniqueOrThrow({ where: { id: comercianteSuspendido.puestoId } });
    await prisma.comerciante.update({ where: { id: pu.comercianteId }, data: { estado: 'SUSPENDIDO' } });
    const catInactiva = await datos.producto(true);
    const cat = await prisma.categoria.create({ data: { nombre: `Inactiva ${tag}`, slug: `${tag}-inactiva`, activa: false } });
    categoriasExtra.push(cat.id);
    await prisma.producto.update({ where: { id: catInactiva.productoId }, data: { categoriaId: cat.id } });

    const ids = [visible1, visible2, borrador, desactivado, puestoInactivo, comercianteSuspendido, catInactiva].map((p) => p.productoId);
    const lote = await repoSimple.detalles(ids);
    expect(lote.map((p) => p.id).sort()).toEqual([visible1.productoId, visible2.productoId].sort());
    for (const p of lote) expect(p).toEqual(await repoSimple.detalle(p.id)); // mismos datos que la consulta individual
    expect(lote.find((p) => p.id === visible2.productoId)).toMatchObject({ precio: '19.99', puesto: { id: visible2.puestoId } });
    // los no expuestos también los omite `detalle` (misma regla de visibilidad)
    for (const o of [borrador, desactivado, puestoInactivo, comercianteSuspendido, catInactiva]) expect(await repoSimple.detalle(o.productoId)).toBeNull();
  });

  it('identificadores inexistentes y lista vacía: sin resultados y sin error', async () => {
    expect(await repoSimple.detalles([])).toEqual([]);
    expect(await repoSimple.detalles(['00000000-0000-4000-8000-0000000000aa'])).toEqual([]);
  });

  it('el caso de uso entrega un mapa por identificador con los mismos datos', async () => {
    const [a, b] = await Promise.all([datos.producto(true, '0.10'), datos.producto(true, '59.97')]);
    const m = await new ObtenerDetallesCatalogo(repoSimple).ejecutar([a.productoId, b.productoId, a.productoId]);
    expect([...m.keys()].sort()).toEqual([a.productoId, b.productoId].sort());
    expect(m.get(b.productoId)?.precio).toBe('59.97');
  });
});

describe('número de consultas independiente de la cantidad de identificadores', () => {
  it('N identificadores cuestan lo mismo que uno solo (no hay una consulta por producto)', async () => {
    const u = new URL(exigirBaseAislada(process.env['DATABASE_URL']));
    u.searchParams.set('application_name', 'poc_uow_t004log');
    const registro: string[] = [];
    const clienteLog = new PrismaClient({ adapter: new PrismaPg({ connectionString: u.toString(), max: 2 }), log: [{ emit: 'event', level: 'query' }] });
    (clienteLog as unknown as { $on(e: string, cb: (ev: { query: string }) => void): void }).$on('query', (ev) => registro.push(ev.query));
    try {
      const repoLog = new PrismaCatalogoRepository(clienteLog as unknown as PrismaService);
      const productos = await Promise.all(Array.from({ length: 20 }, () => datos.producto(true)));
      const ids = productos.map((p) => p.productoId);

      registro.length = 0;
      expect(await repoLog.detalles([ids[0]!])).toHaveLength(1);
      const consultasUno = registro.length;

      registro.length = 0;
      expect(await repoLog.detalles(ids)).toHaveLength(20);
      const consultasVeinte = registro.length;

      registro.length = 0;
      for (const id of ids) await repoLog.detalle(id); // la alternativa que se evita: una por producto
      const consultasIndividuales = registro.length;

      process.stdout.write(`T004 · consultas: 1 id = ${consultasUno}; 20 ids en lote = ${consultasVeinte}; 20 ids uno a uno = ${consultasIndividuales}\n`);
      expect(consultasUno).toBeGreaterThan(0);
      expect(consultasVeinte).toBe(consultasUno);
      expect(consultasIndividuales).toBeGreaterThanOrEqual(20);
    } finally {
      await clienteLog.$disconnect();
    }
  });
});

describe('por la conexión activa de la unidad de trabajo', () => {
  it('dentro de una unidad lee lo escrito por la unidad sin confirmar (misma transacción) y desde fuera no se ve', async () => {
    const base = await datos.producto(true);
    const original = await prisma.producto.findUniqueOrThrow({ where: { id: base.productoId } });
    let nuevoId = '';
    await servicio.unidadDeTrabajo(async () => {
      const creado = await servicio.db.producto.create({
        data: { puestoId: original.puestoId, categoriaId: original.categoriaId, nombre: `Nuevo ${tag}`, precio: '1.25', unidadVenta: 'UNIDAD', estado: 'PUBLICADO' },
      });
      nuevoId = creado.id;
      const lote = await repoServicio.detalles([creado.id, base.productoId]);
      expect(lote.map((p) => p.id).sort()).toEqual([creado.id, base.productoId].sort()); // ve lo no confirmado: misma conexión
      // Otra conexión no lo ve. (Se observa con la API de modelos del cliente simple, que no usa `db()`: `db()` une a la unidad
      // vigente a cualquier cliente porque el contexto es global; en producción hay un único PrismaService.)
      expect(await prisma.producto.findMany({ where: { id: creado.id } })).toEqual([]);
    });
    expect((await repoSimple.detalles([nuevoId])).map((p) => p.id)).toEqual([nuevoId]); // tras el COMMIT, sí
    await prisma.producto.delete({ where: { id: nuevoId } });
  });

  it('si la unidad falla, lo creado en ella no queda (y `detalles` no abrió otra transacción)', async () => {
    const base = await datos.producto(true);
    const original = await prisma.producto.findUniqueOrThrow({ where: { id: base.productoId } });
    let nuevoId = '';
    await expect(servicio.unidadDeTrabajo(async () => {
      nuevoId = (await servicio.db.producto.create({ data: { puestoId: original.puestoId, categoriaId: original.categoriaId, nombre: `Fallido ${tag}`, precio: '2.00', unidadVenta: 'UNIDAD', estado: 'PUBLICADO' } })).id;
      expect(await repoServicio.detalles([nuevoId])).toHaveLength(1);
      throw new Error('fallo');
    })).rejects.toThrow('fallo');
    expect(await prisma.producto.findUnique({ where: { id: nuevoId } })).toBeNull();
  });

  it('fuera de una unidad, el repositorio sobre PrismaService funciona igual', async () => {
    const p = await datos.producto(true);
    expect((await repoServicio.detalles([p.productoId])).map((x) => x.id)).toEqual([p.productoId]);
    expect(normalizar(await repoServicio.detalles([p.productoId]))).toEqual(normalizar(await repoSimple.detalles([p.productoId])));
  });

  it('límite conocido: las lecturas existentes (`detalle`, `buscar`) siguen usando el cliente base y el resguardo las rechaza dentro de una unidad', async () => {
    const p = await datos.producto(true);
    await expect(servicio.unidadDeTrabajo(async () => { await repoServicio.detalle(p.productoId); })).rejects.toBeInstanceOf(ClienteBaseEnUnidadError);
  });
});
