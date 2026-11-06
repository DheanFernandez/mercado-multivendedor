/**
 * Restricciones del modelo de productos y repositorios Prisma contra la base de desarrollo (npm run test:db).
 * - Las restricciones se prueban en transacciones que siempre se revierten.
 * - Los repositorios necesitan datos confirmados: se crean con una etiqueta única y se BORRAN al terminar
 *   (solo filas creadas por esta prueba).
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaCatalogoRepository } from '../src/modules/catalog/infrastructure/prisma-catalogo.repository.js';
import { PrismaCategoriaRepository, PrismaProductoRepository } from '../src/modules/products/infrastructure/prisma-products.repositories.js';
import { Categoria } from '../src/modules/products/domain/categoria.entity.js';
import { CategoriaDuplicadaError } from '../src/modules/products/domain/errors.js';
import { Producto } from '../src/modules/products/domain/producto.entity.js';
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { exigirBaseAislada } from '../scripts/base-aislada.mjs';

const url = exigirBaseAislada(process.env['DATABASE_URL']); // solo la base local de Docker
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 3 }) });
const servicio = prisma as unknown as PrismaService;
const TAG = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

class Revertir extends Error {}
async function enTransaccionRevertida(fn: (tx: Prisma.TransactionClient) => Promise<void>) {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      throw new Revertir();
    });
  } catch (e) {
    if (!(e instanceof Revertir)) throw e;
  }
}
const codigo = (e: unknown) => (e instanceof Prisma.PrismaClientKnownRequestError ? e.code : e instanceof Error ? e.message : String(e));
async function falla(op: Promise<unknown>) {
  try { await op; } catch (e) { return e; }
  return undefined;
}

/** Ejecuta `preparar` y luego `op` en una transacción propia (se revierte) y devuelve el código del error de `op`. */
async function fallo<T>(preparar: (tx: Prisma.TransactionClient) => Promise<T>, op: (tx: Prisma.TransactionClient, ctx: T) => Promise<unknown>) {
  let resultado: string | undefined = 'SIN_ERROR';
  await enTransaccionRevertida(async (tx) => {
    const ctx = await preparar(tx);
    const e = await falla(op(tx, ctx));
    resultado = e === undefined ? 'SIN_ERROR' : codigo(e);
  });
  return resultado;
}

/** Crea usuario → comerciante → puesto dentro de `tx` (o del cliente) y devuelve los ids. */
async function sembrarPuesto(db: Prisma.TransactionClient | PrismaClient, n: string, extra: { puesto?: 'ACTIVO' | 'INACTIVO'; comerciante?: 'ACTIVO' | 'SUSPENDIDO' } = {}) {
  const u = await db.usuario.create({ data: { email: `${TAG}-${n}@prueba.test`, nombres: 'N', apellidos: 'A', rol: 'COMERCIANTE' } });
  const c = await db.comerciante.create({ data: { usuarioId: u.id, nombreComercial: `Com ${TAG} ${n}`, estado: extra.comerciante ?? 'ACTIVO' } });
  const p = await db.puesto.create({ data: { comercianteId: c.id, codigo: `${TAG}-${n}`.toUpperCase(), nombre: `Puesto ${n}`, estado: extra.puesto ?? 'ACTIVO' } });
  return { usuarioId: u.id, comercianteId: c.id, puestoId: p.id };
}
const slugDe = (n: string) => `${TAG}-${n}`;
const categoria = (db: Prisma.TransactionClient | PrismaClient, n: string, activa = true) =>
  db.categoria.create({ data: { nombre: `Cat ${n}`, slug: slugDe(n), activa } });
const producto = (db: Prisma.TransactionClient | PrismaClient, puestoId: string, categoriaId: string, extra: Partial<Prisma.ProductoUncheckedCreateInput> = {}) =>
  db.producto.create({ data: { puestoId, categoriaId, nombre: `Prod ${TAG}`, precio: new Prisma.Decimal('3.50'), unidadVenta: 'UNIDAD', ...extra } });

afterAll(async () => {
  // Limpieza: solo filas con la etiqueta de esta ejecución.
  const puestos = await prisma.puesto.findMany({ where: { codigo: { startsWith: TAG.toUpperCase() } }, select: { id: true, comercianteId: true } });
  await prisma.producto.deleteMany({ where: { puestoId: { in: puestos.map((p) => p.id) } } }); // cascada a imágenes
  await prisma.puesto.deleteMany({ where: { id: { in: puestos.map((p) => p.id) } } });
  await prisma.comerciante.deleteMany({ where: { id: { in: puestos.map((p) => p.comercianteId) } } });
  await prisma.usuario.deleteMany({ where: { email: { startsWith: `${TAG}-` } } });
  await prisma.categoria.deleteMany({ where: { slug: { startsWith: `${TAG}-` } } });
  await prisma.$disconnect();
});

describe('Restricciones del modelo de productos (PostgreSQL)', { timeout: 60_000 }, () => {
  it('el precio se almacena exacto (NUMERIC) y se lee como texto con 2 decimales', () =>
    enTransaccionRevertida(async (tx) => {
      const s = await sembrarPuesto(tx, 'a');
      const c = await categoria(tx, 'a');
      const p = await producto(tx, s.puestoId, c.id, { precio: new Prisma.Decimal('0.10') });
      const q = await producto(tx, s.puestoId, c.id, { precio: new Prisma.Decimal('19.99') });
      const suma = await tx.producto.aggregate({ _sum: { precio: true }, where: { id: { in: [p.id, q.id] } } });
      expect(suma._sum.precio!.toFixed(2)).toBe('20.09'); // 0.10 + 19.99 sin error de coma flotante
      expect(p.estado).toBe('BORRADOR');
    }));

  it.each(['0', '-1.00'])('rechaza precio %s (CHECK precio > 0)', (precio) =>
    enTransaccionRevertida(async (tx) => {
      const s = await sembrarPuesto(tx, 'b');
      const c = await categoria(tx, 'b');
      expect(await falla(producto(tx, s.puestoId, c.id, { precio: new Prisma.Decimal(precio) }))).toBeDefined();
    }));

  it('rechaza un precio que excede NUMERIC(10,2)', () =>
    enTransaccionRevertida(async (tx) => {
      const s = await sembrarPuesto(tx, 'c');
      const c = await categoria(tx, 'c');
      expect(await falla(producto(tx, s.puestoId, c.id, { precio: new Prisma.Decimal('100000000.00') }))).toBeDefined();
    }));

  it('rechaza nombre de producto vacío (CHECK)', () =>
    enTransaccionRevertida(async (tx) => {
      const s = await sembrarPuesto(tx, 'd');
      const c = await categoria(tx, 'd');
      expect(await falla(producto(tx, s.puestoId, c.id, { nombre: '   ' }))).toBeDefined();
    }));

  it('exige puesto y categoría existentes (FK)', async () => {
    const falso = '00000000-0000-4000-8000-0000000000ff';
    const prep = async (tx: Prisma.TransactionClient) => ({ s: await sembrarPuesto(tx, 'e'), c: await categoria(tx, 'e') });
    expect(await fallo(prep, (tx, { c }) => producto(tx, falso, c.id))).toBe('P2003');
    expect(await fallo(prep, (tx, { s }) => producto(tx, s.puestoId, falso))).toBe('P2003');
  });

  it('el slug de categoría es único y tiene formato válido (CHECK)', async () => {
    const prep = async (tx: Prisma.TransactionClient) => categoria(tx, 'f');
    expect(await fallo(prep, (tx) => categoria(tx, 'f'))).toBe('P2002');
    expect(await fallo(prep, (tx) => tx.categoria.create({ data: { nombre: 'X', slug: 'Slug Inválido!' } }))).not.toBe('SIN_ERROR');
    expect(await fallo(prep, (tx) => tx.categoria.create({ data: { nombre: '  ', slug: slugDe('g') } }))).not.toBe('SIN_ERROR');
  });

  it('no se puede eliminar un puesto ni una categoría con productos (RESTRICT)', async () => {
    const prep = async (tx: Prisma.TransactionClient) => {
      const s = await sembrarPuesto(tx, 'h');
      const c = await categoria(tx, 'h');
      await producto(tx, s.puestoId, c.id);
      return { s, c };
    };
    expect(await fallo(prep, (tx, { s }) => tx.puesto.delete({ where: { id: s.puestoId } }))).toBe('P2003');
    expect(await fallo(prep, (tx, { c }) => tx.categoria.delete({ where: { id: c.id } }))).toBe('P2003');
  });

  it('imágenes: orden único por producto, ruta única, orden no negativo', async () => {
    const prep = async (tx: Prisma.TransactionClient) => {
      const s = await sembrarPuesto(tx, 'i');
      const c = await categoria(tx, 'i');
      const p = await producto(tx, s.puestoId, c.id);
      await tx.productoImagen.create({ data: { productoId: p.id, ruta: `${TAG}/a.png`, orden: 0 } });
      return p;
    };
    expect(await fallo(prep, (tx, p) => tx.productoImagen.create({ data: { productoId: p.id, ruta: `${TAG}/b.png`, orden: 0 } }))).toBe('P2002');
    expect(await fallo(prep, (tx, p) => tx.productoImagen.create({ data: { productoId: p.id, ruta: `${TAG}/a.png`, orden: 1 } }))).toBe('P2002');
    expect(await fallo(prep, (tx, p) => tx.productoImagen.create({ data: { productoId: p.id, ruta: `${TAG}/c.png`, orden: -1 } }))).not.toBe('SIN_ERROR');
  });

  it('al eliminar un producto se eliminan sus imágenes (CASCADE)', () =>
    enTransaccionRevertida(async (tx) => {
      const s = await sembrarPuesto(tx, 'j');
      const c = await categoria(tx, 'j');
      const p = await producto(tx, s.puestoId, c.id);
      await tx.productoImagen.create({ data: { productoId: p.id, ruta: `${TAG}/j.png`, orden: 0 } });
      await tx.producto.delete({ where: { id: p.id } });
      expect(await tx.productoImagen.count({ where: { productoId: p.id } })).toBe(0);
    }));

  it('las tablas nuevas tienen RLS activado', async () => {
    const filas = await prisma.$queryRaw<{ relrowsecurity: boolean }[]>`
      SELECT relrowsecurity FROM pg_class WHERE relname IN ('categorias', 'productos', 'producto_imagenes') AND relkind = 'r'`;
    expect(filas).toHaveLength(3);
    expect(filas.every((f) => f.relrowsecurity)).toBe(true);
  });
});

describe('Repositorios Prisma (datos confirmados y limpiados al final)', { timeout: 120_000 }, () => {
  const repoCat = new PrismaCategoriaRepository(servicio);
  const repoProd = new PrismaProductoRepository(servicio);
  const repoCatalogo = new PrismaCatalogoRepository(servicio);
  let activo: Awaited<ReturnType<typeof sembrarPuesto>>;
  let catA: { id: string };

  beforeAll(async () => {
    activo = await sembrarPuesto(prisma, 'r1');
    catA = await categoria(prisma, 'r1');
  });

  it('categorías: guardar, buscar, actualizar y detectar duplicados', async () => {
    const c = Categoria.crear({ id: randomUUID(), nombre: `Lácteos ${TAG}` });
    // el slug del dominio no lleva la etiqueta como prefijo: se limpia por slug exacto
    await repoCat.guardar(c);
    try {
      expect((await repoCat.buscarPorId(c.id))!.slug).toBe(c.slug);
      c.actualizar({ descripcion: 'Leche y derivados' });
      c.cambiarDisponibilidad(false);
      await repoCat.guardar(c);
      expect(await repoCat.buscarPorId(c.id)).toMatchObject({ descripcion: 'Leche y derivados', activa: false });
      expect((await repoCat.listar({ soloActivas: true })).some((x) => x.id === c.id)).toBe(false);
      expect((await repoCat.listar({ soloActivas: false })).some((x) => x.id === c.id)).toBe(true);
      const duplicada = Categoria.crear({ id: randomUUID(), nombre: `LÁCTEOS ${TAG}` });
      await expect(repoCat.guardar(duplicada)).rejects.toBeInstanceOf(CategoriaDuplicadaError);
    } finally {
      await prisma.categoria.deleteMany({ where: { id: c.id } });
    }
  });

  it('productos: ida y vuelta con precio exacto, imágenes ordenadas y sincronización', async () => {
    const p = Producto.crear({ id: randomUUID(), puestoId: activo.puestoId, categoriaId: catA.id, nombre: `Papa ${TAG}`, precio: '4.25', unidadVenta: 'KILOGRAMO', presentacion: 'saco' });
    p.agregarImagen({ id: randomUUID(), ruta: `${TAG}/1.png`, textoAlternativo: 'uno' });
    const segunda = p.agregarImagen({ id: randomUUID(), ruta: `${TAG}/2.png` });
    await repoProd.guardar(p);

    const leido = (await repoProd.buscarPorId(p.id))!;
    expect(leido.precio.toString()).toBe('4.25');
    expect(leido.imagenes.map((i) => i.orden)).toEqual([0, 1]);

    leido.actualizar({ precio: '5', nombre: `Papa blanca ${TAG}` });
    leido.quitarImagen(segunda.id);
    leido.publicar();
    await repoProd.guardar(leido);
    const tras = (await repoProd.buscarPorId(p.id))!;
    expect(tras).toMatchObject({ nombre: `Papa blanca ${TAG}`, estado: 'PUBLICADO', puestoId: activo.puestoId });
    expect(tras.precio.toString()).toBe('5.00');
    expect(tras.imagenes).toHaveLength(1);
    expect(await prisma.productoImagen.count({ where: { productoId: p.id } })).toBe(1);
  });

  it('productos: listar por puestos, categoría, estado y paginar', async () => {
    for (let i = 0; i < 3; i++) {
      await repoProd.guardar(Producto.crear({ id: randomUUID(), puestoId: activo.puestoId, categoriaId: catA.id, nombre: `Lista ${i} ${TAG}`, precio: '1', unidadVenta: 'UNIDAD' }));
    }
    const pagina1 = await repoProd.listar({ puestoIds: [activo.puestoId], categoriaId: catA.id, limite: 2, desplazamiento: 0 });
    expect(pagina1.items).toHaveLength(2);
    expect(pagina1.total).toBeGreaterThanOrEqual(4);
    expect((await repoProd.listar({ puestoIds: [], limite: 10, desplazamiento: 0 })).total).toBe(0);
    expect((await repoProd.listar({ puestoId: activo.puestoId, estado: 'PUBLICADO', limite: 10, desplazamiento: 0 })).items.every((x) => x.estado === 'PUBLICADO')).toBe(true);
  });

  it('catálogo: solo productos publicados de puestos, comerciantes y categorías activos', async () => {
    const suspendido = await sembrarPuesto(prisma, 'r2', { comerciante: 'SUSPENDIDO' });
    const cerrado = await sembrarPuesto(prisma, 'r3', { puesto: 'INACTIVO' });
    const catInactiva = await categoria(prisma, 'r4', false);
    const publicado = (puestoId: string, categoriaId: string, nombre: string, precio: string, estado: 'PUBLICADO' | 'BORRADOR' | 'DESACTIVADO' = 'PUBLICADO') =>
      producto(prisma, puestoId, categoriaId, { nombre: `${nombre} ${TAG}`, precio: new Prisma.Decimal(precio), estado });

    const visible = await publicado(activo.puestoId, catA.id, 'Visible', '10.00');
    const barato = await publicado(activo.puestoId, catA.id, 'Barato', '0.10');
    const borrador = await publicado(activo.puestoId, catA.id, 'Borrador', '5', 'BORRADOR');
    const desactivado = await publicado(activo.puestoId, catA.id, 'Desactivado', '5', 'DESACTIVADO');
    const deSuspendido = await publicado(suspendido.puestoId, catA.id, 'Suspendido', '5');
    const deCerrado = await publicado(cerrado.puestoId, catA.id, 'Cerrado', '5');
    const deCatInactiva = await publicado(activo.puestoId, catInactiva.id, 'CatInactiva', '5');
    await prisma.productoImagen.create({ data: { productoId: visible.id, ruta: `${TAG}/v.png`, orden: 0 } });

    const buscar = (extra: object = {}) => repoCatalogo.buscar({ texto: TAG, orden: 'nombre', limite: 50, desplazamiento: 0, ...extra });
    const ids = async (extra: object = {}) => (await buscar(extra)).items.map((i) => i.id);

    const todos = await ids();
    expect(todos).toEqual(expect.arrayContaining([visible.id, barato.id]));
    for (const oculto of [borrador, desactivado, deSuspendido, deCerrado, deCatInactiva]) expect(todos).not.toContain(oculto.id);

    expect(await repoCatalogo.detalle(borrador.id)).toBeNull();
    expect(await repoCatalogo.detalle(deSuspendido.id)).toBeNull();
    const d = (await repoCatalogo.detalle(visible.id))!;
    expect(d).toMatchObject({ precio: '10.00', puesto: { id: activo.puestoId }, categoria: { id: catA.id } });
    expect(d.imagenes).toHaveLength(1);

    // filtros: precio inclusivo y exacto, categoría, puesto
    expect(await ids({ precioMinCentimos: 1000 })).toContain(visible.id);
    expect(await ids({ precioMinCentimos: 1001 })).not.toContain(visible.id);
    expect(await ids({ precioMaxCentimos: 10 })).toEqual([barato.id]);
    expect(await ids({ categoriaId: catInactiva.id })).toEqual([]);
    expect(await ids({ puestoId: suspendido.puestoId })).toEqual([]);
    expect(await ids({ texto: 'vIsIbLe' + ' ' + TAG })).toContain(visible.id); // insensible a mayúsculas

    // orden por precio y paginación con total consistente
    const asc = (await buscar({ orden: 'precio_asc' })).items.map((i) => i.precio);
    expect(asc).toEqual([...asc].sort((a, b) => Number(a) - Number(b)));
    const pag = await buscar({ limite: 1, desplazamiento: 1, orden: 'precio_desc' });
    expect(pag.items).toHaveLength(1);
    expect(pag.total).toBe(todos.length);
  });
});
