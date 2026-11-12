/**
 * T005 · API pública de Carrito para Pedidos (spec 003-pedidos-subpedidos; Q4, FR-027; CA-O23).
 * Cableado REAL: repositorio del carrito + lote de Catálogo (por la conexión activa) sobre un `PrismaService`.
 * `ObtenerCarritoParaPedido` solo existe dentro de una unidad: toma los bloqueos y devuelve el contenido AUTORITATIVO;
 * `VaciarCarritoDelPedido` borra las líneas ya bloqueadas en la misma unidad.
 *
 * Solo el PostgreSQL local aislado; los datos llevan una etiqueta única y se eliminan al terminar.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ObtenerCarritoParaPedido, VaciarCarritoDelPedido } from '../src/modules/cart/application/use-cases/pedido.use-cases.js';
import { ProductosVendiblesLoteAdapter } from '../src/modules/cart/infrastructure/adaptadores.js';
import { PrismaCarritoRepository } from '../src/modules/cart/infrastructure/prisma-carrito.repository.js';
import { ObtenerDetallesCatalogo } from '../src/modules/catalog/application/use-cases/catalogo.use-cases.js';
import { PrismaCatalogoRepository } from '../src/modules/catalog/infrastructure/prisma-catalogo.repository.js';
import { UnidadDeTrabajoRequeridaError } from '../src/shared/domain/unidad-de-trabajo.error.js';
import { DatosCarrito } from './helpers/carrito-db.js';
import { abrirBase, etiqueta, Fixtures } from './helpers/inventario-db.js';
import { crearPrismaService } from './helpers/prisma-service-db.js';

const { prisma } = abrirBase();
const servicio = crearPrismaService('t005', 10);
const unaConexion = crearPrismaService('t005uno', 1); // pool de UNA conexión: cualquier lectura por otra conexión se bloquearía
const tag = etiqueta();
const datos = new DatosCarrito(prisma, new Fixtures(prisma, tag), tag);

function cablear(s: typeof servicio) {
  const repo = new PrismaCarritoRepository(s);
  const lote = new ProductosVendiblesLoteAdapter(new ObtenerDetallesCatalogo(new PrismaCatalogoRepository(s)));
  return { repo, obtener: new ObtenerCarritoParaPedido(repo, lote), vaciar: new VaciarCarritoDelPedido(repo) };
}
const { repo, obtener, vaciar } = cablear(servicio);
const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const agregar = (u: string, p: { productoId: string; puestoId: string }, cantidad = 1) =>
  repo.agregar({ usuarioId: u, productoId: p.productoId, puestoId: p.puestoId, cantidad, tope: 1000, maxItems: 50 });

beforeAll(async () => { await prisma.$connect(); });
afterAll(async () => {
  await datos.limpiar();
  await servicio.$disconnect();
  await unaConexion.$disconnect();
  await prisma.$disconnect();
});

describe('ObtenerCarritoParaPedido con PostgreSQL', () => {
  it('exige una unidad de trabajo: fuera de ella falla de inmediato', async () => {
    const u = await datos.cliente();
    await expect(obtener.ejecutar(u)).rejects.toBeInstanceOf(UnidadDeTrabajoRequeridaError);
    await expect(vaciar.ejecutar(u)).rejects.toBeInstanceOf(UnidadDeTrabajoRequeridaError);
  });

  it('cliente sin carrito: vacío y sin crear nada; carrito vacío: con su identificador', async () => {
    const sin = await datos.cliente();
    expect(await servicio.unidadDeTrabajo(() => obtener.ejecutar(sin))).toEqual({ carritoId: null, lineas: [] });
    expect(await prisma.carrito.count({ where: { usuarioId: sin } })).toBe(0);

    const vacio = await datos.cliente();
    const p = await datos.producto();
    await agregar(vacio, p);
    await repo.quitar({ usuarioId: vacio, productoId: p.productoId });
    const r = await servicio.unidadDeTrabajo(() => obtener.ejecutar(vacio));
    expect(r.carritoId).toBe((await prisma.carrito.findUniqueOrThrow({ where: { usuarioId: vacio } })).id);
    expect(r.lineas).toEqual([]);
  });

  it('devuelve las líneas ordenadas por producto con precio en céntimos exactos y marca las no comprables', async () => {
    const u = await datos.cliente();
    const [mango, cilantro, palta, borrador] = await Promise.all([datos.producto(true, '6.50'), datos.producto(true, '0.10'), datos.producto(true, '19.99'), datos.producto(false)]);
    const desactivado = await datos.producto(true);
    await prisma.producto.update({ where: { id: desactivado.productoId }, data: { estado: 'DESACTIVADO' } });
    for (const [p, c] of [[mango, 3], [cilantro, 3], [palta, 3], [borrador, 2], [desactivado, 1]] as const) await agregar(u, p, c);

    const r = await servicio.unidadDeTrabajo(() => obtener.ejecutar(u));
    expect(r.lineas.map((l) => l.productoId)).toEqual([mango, cilantro, palta, borrador, desactivado].map((p) => p.productoId).sort());
    const por = (p: { productoId: string }) => r.lineas.find((l) => l.productoId === p.productoId)!;
    expect(por(mango)).toMatchObject({ comprable: true, cantidad: 3, precioUnitarioCentimos: 650, puesto: { id: mango.puestoId } });
    expect(por(cilantro).precioUnitarioCentimos).toBe(10); // 0.10 sin error de coma flotante
    expect(por(palta).precioUnitarioCentimos).toBe(1999);
    expect(por(borrador)).toMatchObject({ comprable: false, puesto: null, nombre: null, precioUnitarioCentimos: null, cantidad: 2 });
    expect(por(desactivado)).toMatchObject({ comprable: false, cantidad: 1 });
  });

  it('lee carrito y catálogo por UNA sola conexión: con un pool de 1 conexión termina sin bloquearse', async () => {
    const c1 = cablear(unaConexion);
    const u = await datos.cliente();
    const ps = await Promise.all([datos.producto(), datos.producto(), datos.producto()]);
    for (const p of ps) await c1.repo.agregar({ usuarioId: u, productoId: p.productoId, puestoId: p.puestoId, cantidad: 2, tope: 100, maxItems: 50 });
    const r = await unaConexion.unidadDeTrabajo(async () => {
      const leido = await c1.obtener.ejecutar(u);
      await c1.vaciar.ejecutar(u);
      return leido;
    });
    expect(r.lineas).toHaveLength(3);
    expect(r.lineas.every((l) => l.comprable)).toBe(true);
    expect(await datos.items(u)).toEqual([]);
  });

  it('admite el máximo de 50 productos distintos en una lectura', async () => {
    const u = await datos.cliente();
    const ps = await Promise.all(Array.from({ length: 50 }, () => datos.producto()));
    for (const p of ps) await agregar(u, p);
    const r = await servicio.unidadDeTrabajo(() => obtener.ejecutar(u));
    expect(r.lineas).toHaveLength(50);
    expect(r.lineas.every((l) => l.comprable)).toBe(true);
  });
});

describe('lectura bloqueada y vaciado atómicos (Q4 · CA-O23)', () => {
  it('si la unidad falla después de leer y vaciar, el carrito conserva todas sus líneas; si confirma, queda vacío', async () => {
    const u = await datos.cliente();
    const [a, b] = await Promise.all([datos.producto(), datos.producto()]);
    await agregar(u, a, 2);
    await agregar(u, b, 3);
    await expect(servicio.unidadDeTrabajo(async () => { await obtener.ejecutar(u); await vaciar.ejecutar(u); throw new Error('fallo'); })).rejects.toThrow('fallo');
    expect(await datos.items(u)).toHaveLength(2);
    await servicio.unidadDeTrabajo(async () => { await obtener.ejecutar(u); await vaciar.ejecutar(u); });
    expect(await datos.items(u)).toEqual([]);
  });

  it('ninguna edición concurrente se pierde ni se duplica: cada línea nueva está en lo leído (y vaciado) o en el carrito posterior, nunca en ambos ni en ninguno', async () => {
    const u = await datos.cliente();
    const [a, b, x] = await Promise.all([datos.producto(), datos.producto(), datos.producto()]);
    let enLoLeido = 0;
    let enElCarrito = 0;
    const N = 40;
    for (let i = 0; i < N; i++) {
      await repo.vaciar(u);
      await agregar(u, a, 2);
      await agregar(u, b, 1);
      const [lineasLeidas] = await Promise.all([
        dormir((i * 5) % 11).then(() => servicio.unidadDeTrabajo(async () => {
          const r = await obtener.ejecutar(u);
          await dormir(i % 7);
          await vaciar.ejecutar(u);
          return r.lineas.map((l) => l.productoId);
        })),
        dormir((i * 3) % 7).then(() => agregar(u, x, 5)),
      ]);
      const finales = (await datos.items(u)).map((it) => it.productoId);
      const xLeida = lineasLeidas.includes(x.productoId);
      const xFinal = finales.includes(x.productoId);
      expect(xLeida !== xFinal, `iteración ${i}: x leída=${xLeida}, x final=${xFinal}`).toBe(true); // exactamente uno de los dos
      expect(lineasLeidas.filter((p) => p === x.productoId).length).toBeLessThanOrEqual(1);
      expect(finales.filter((p) => p === x.productoId).length).toBeLessThanOrEqual(1);
      expect(lineasLeidas).toEqual(expect.arrayContaining([a.productoId, b.productoId])); // lo previo SIEMPRE se lee
      expect(finales).not.toContain(a.productoId); // y se vació
      expect(finales).not.toContain(b.productoId);
      if (xLeida) enLoLeido++; else enElCarrito++;
    }
    process.stdout.write(`T005 · ${N} carreras: línea nueva incluida en lo leído = ${enLoLeido}, conservada en el carrito = ${enElCarrito}\n`);
  });

  it('una edición terminada ANTES del bloqueo se incluye en lo leído (cantidad vigente)', async () => {
    const u = await datos.cliente();
    const a = await datos.producto();
    await agregar(u, a, 1);
    await repo.fijarCantidad({ usuarioId: u, productoId: a.productoId, cantidad: 7 });
    const r = await servicio.unidadDeTrabajo(() => obtener.ejecutar(u));
    expect(r.lineas.map((l) => l.cantidad)).toEqual([7]);
  });

  it('mientras la unidad conserva el bloqueo, fijarCantidad y quitar esperan y luego fallan sobre el carrito vaciado (no se pierde nada)', async () => {
    const u = await datos.cliente();
    const [a, b, c] = await Promise.all([datos.producto(), datos.producto(), datos.producto()]);
    await agregar(u, a, 2);
    await agregar(u, b, 3);
    let listo!: () => void;
    const bloqueado = new Promise<void>((r) => (listo = r));
    const unidad = servicio.unidadDeTrabajo(async () => {
      const r = await obtener.ejecutar(u);
      listo();
      await dormir(300);
      await vaciar.ejecutar(u);
      return r.lineas.map((l) => [l.productoId, l.cantidad] as const);
    });
    await bloqueado;
    const [fijar, quitar, nueva] = await Promise.all([
      repo.fijarCantidad({ usuarioId: u, productoId: a.productoId, cantidad: 9 }),
      repo.quitar({ usuarioId: u, productoId: b.productoId }),
      agregar(u, c, 4),
    ]);
    const leidas = await unidad;
    expect([...leidas].sort()).toEqual([[a.productoId, 2], [b.productoId, 3]].sort()); // lo confirmado antes del bloqueo
    expect({ fijar, quitar, nueva: nueva.resultado }).toEqual({ fijar: false, quitar: false, nueva: 'AGREGADO' });
    expect(await datos.items(u)).toEqual([{ productoId: c.productoId, cantidad: 4 }]); // la línea nueva sobrevive, una sola vez
  });
});
