/**
 * ARNÉS DE MEDICIÓN EQ-03 (no es parte de la API del producto). Expone por HTTP la operación que el módulo de pedidos
 * invocará (ReservarInventario) para que k6 repita la prueba con volumen. Usa las MISMAS clases de producción
 * (caso de uso + repositorio PostgreSQL) y SOLO la base local aislada: aborta si la URL no lo es.
 *
 *   npm run build && node dist/scripts/servidor-eq03.js          (puerto EQ03_PUERTO, 3101 por defecto)
 *   POST /eq03/preparar?stock=S   crea/reutiliza el producto de prueba y restablece su stock a S
 *   POST /eq03/reservar           {productoId, clave} → 201 reservada | 409 falta de stock | 500 inesperado
 *   GET  /eq03/estado?productoId= stock físico/reservado, reservas aceptadas y la comprobación SQL
 *   POST /eq03/limpiar            borra los datos creados por el arnés
 */
import 'dotenv/config';
import { createServer, type IncomingMessage } from 'node:http';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { ReservarInventario } from '../modules/inventory/application/use-cases/inventario.use-cases.js';
import { StockInsuficienteError } from '../modules/inventory/domain/errors.js';
import { PrismaInventarioRepository } from '../modules/inventory/infrastructure/prisma-inventario.repository.js';
import type { PrismaService } from '../shared/infrastructure/prisma/prisma.service.js';
import { urlDePruebas } from '../../scripts/base-aislada.mjs';

const url = urlDePruebas(); // aborta si no es la base local de Docker
const puerto = Number(process.env['EQ03_PUERTO'] ?? 3101);
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: Number(process.env['DATABASE_POOL_MAX'] ?? 10) }) });
const reservar = new ReservarInventario(new PrismaInventarioRepository(prisma as unknown as PrismaService));
const TAG = 'eq03k6';

async function fixture(): Promise<string> {
  const existente = await prisma.producto.findFirst({ where: { nombre: `Producto ${TAG}` } });
  if (existente) return existente.id;
  const u = await prisma.usuario.create({ data: { email: `${TAG}@medicion.test`, nombres: 'EQ03', apellidos: 'K6', rol: 'COMERCIANTE' } });
  const c = await prisma.comerciante.create({ data: { usuarioId: u.id, nombreComercial: `Comercio ${TAG}` } });
  const p = await prisma.puesto.create({ data: { comercianteId: c.id, codigo: TAG.toUpperCase(), nombre: `Puesto ${TAG}` } });
  const cat = await prisma.categoria.create({ data: { nombre: `Categoría ${TAG}`, slug: `${TAG}-categoria` } });
  const prod = await prisma.producto.create({ data: { puestoId: p.id, categoriaId: cat.id, nombre: `Producto ${TAG}`, precio: '5.00', unidadVenta: 'UNIDAD' } });
  await prisma.inventario.create({ data: { productoId: prod.id, puestoId: p.id } });
  return prod.id;
}

async function limpiar() {
  const prod = await prisma.producto.findFirst({ where: { nombre: `Producto ${TAG}` } });
  if (!prod) return;
  const p = await prisma.puesto.findUniqueOrThrow({ where: { id: prod.puestoId }, include: { comerciante: true } });
  await prisma.movimientoInventario.deleteMany({ where: { inventario: { productoId: prod.id } } });
  await prisma.reservaInventario.deleteMany({ where: { inventario: { productoId: prod.id } } });
  await prisma.inventario.deleteMany({ where: { productoId: prod.id } });
  await prisma.producto.delete({ where: { id: prod.id } });
  await prisma.categoria.deleteMany({ where: { slug: `${TAG}-categoria` } });
  await prisma.puesto.delete({ where: { id: p.id } });
  await prisma.comerciante.delete({ where: { id: p.comercianteId } });
  await prisma.usuario.delete({ where: { id: p.comerciante.usuarioId } });
}

const leerCuerpo = (req: IncomingMessage) =>
  new Promise<Record<string, unknown>>((ok) => {
    let b = '';
    req.on('data', (d) => (b += d));
    req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch { ok({}); } });
  });

const servidor = createServer(async (req, res) => {
  const u = new URL(req.url ?? '/', 'http://x');
  const responder = (estado: number, cuerpo: unknown) => { res.writeHead(estado, { 'content-type': 'application/json' }); res.end(JSON.stringify(cuerpo)); };
  try {
    if (req.method === 'POST' && u.pathname === '/eq03/preparar') {
      const stock = Number(u.searchParams.get('stock'));
      if (!Number.isInteger(stock) || stock < 1) return responder(400, { error: 'stock inválido' });
      const productoId = await fixture();
      await prisma.reservaInventario.deleteMany({ where: { inventario: { productoId } } });
      await prisma.inventario.update({ where: { productoId }, data: { stockFisico: stock, stockReservado: 0 } });
      return responder(200, { productoId, stock });
    }
    if (req.method === 'POST' && u.pathname === '/eq03/reservar') {
      const { productoId, clave } = await leerCuerpo(req);
      try {
        const r = await reservar.ejecutar({ claveOperacion: clave, items: [{ productoId, cantidad: 1 }], expiraEn: new Date(Date.now() + 3_600_000) });
        return responder(201, { reservada: true, repetida: r.repetida });
      } catch (e) {
        if (e instanceof StockInsuficienteError) return responder(409, { codigo: 'CONFLICTO', mensaje: e.message });
        throw e;
      }
    }
    if (req.method === 'GET' && u.pathname === '/eq03/estado') {
      const productoId = u.searchParams.get('productoId') ?? '';
      const inv = await prisma.inventario.findUniqueOrThrow({ where: { productoId } });
      const aceptadas = await prisma.reservaInventario.aggregate({ where: { inventarioId: inv.id, estado: 'RESERVADA' }, _sum: { cantidad: true }, _count: true });
      const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM inventarios WHERE stock_reservado > stock_fisico`;
      return responder(200, { stockFisico: inv.stockFisico, stockReservado: inv.stockReservado, reservasAceptadas: aceptadas._count, unidadesReservadas: aceptadas._sum.cantidad ?? 0, reservadoSuperaFisico: Number(n) });
    }
    if (req.method === 'POST' && u.pathname === '/eq03/limpiar') {
      await limpiar();
      return responder(200, { limpio: true });
    }
    return responder(404, { error: 'no encontrado' });
  } catch (e) {
    console.error(e);
    return responder(500, { error: 'inesperado' });
  }
});

servidor.listen(puerto, '127.0.0.1', () => console.log(`Arnés EQ-03 en http://127.0.0.1:${puerto} (base: ${new URL(url).host}${new URL(url).pathname})`));
process.on('SIGINT', async () => { servidor.close(); await prisma.$disconnect(); process.exit(0); });
