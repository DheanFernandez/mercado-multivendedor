/**
 * Seed REPRODUCIBLE de datos representativos para las mediciones (EQ-04, EQ-05). Solo para la base AISLADA.
 * Uso:  npm run build && DATABASE_URL=postgresql://postgres:medicion@127.0.0.1:55440/mercado_medicion \
 *         npm run seed:medicion -- --comerciantes 50 --puestos-por-comerciante 2 --productos-por-puesto 50 --categorias 20
 * Guarda: aborta si la URL no apunta a localhost/127.0.0.1 o si menciona Supabase.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { urlDePruebas } from '../../scripts/base-aislada.mjs';

const url = urlDePruebas(); // TEST_DATABASE_URL o la URL local por defecto; nunca DATABASE_URL. Aborta si no es la base local de Docker
const host = new URL(url).hostname;

const arg = (nombre: string, def: number) => {
  const i = process.argv.indexOf(`--${nombre}`);
  const v = i >= 0 ? Number(process.argv[i + 1]) : def;
  if (!Number.isInteger(v) || v < 1) throw new Error(`--${nombre} debe ser un entero positivo`);
  return v;
};
const nComerciantes = arg('comerciantes', 50);
const puestosPor = arg('puestos-por-comerciante', 2);
const productosPor = arg('productos-por-puesto', 50);
const nCategorias = arg('categorias', 20);
const prefijo = process.argv.includes('--prefijo') ? process.argv[process.argv.indexOf('--prefijo') + 1] : 'med';

faker.seed(20261105); // mismos datos en cada ejecución
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 4 }) });
const UNIDADES = ['UNIDAD', 'KILOGRAMO', 'GRAMO', 'LITRO', 'DOCENA', 'MANOJO', 'PAQUETE'] as const;
const lotes = <T>(items: T[], n: number) => Array.from({ length: Math.ceil(items.length / n) }, (_, i) => items.slice(i * n, (i + 1) * n));

try {
  const t0 = Date.now();
  await prisma.categoria.createMany({
    data: Array.from({ length: nCategorias }, (_, i) => ({ nombre: `Categoría ${prefijo} ${i + 1}`, slug: `${prefijo}-categoria-${i + 1}` })),
    skipDuplicates: true,
  });
  await prisma.usuario.createMany({
    data: Array.from({ length: nComerciantes }, (_, i) => ({
      email: `${prefijo}-comerciante-${i + 1}@medicion.test`, nombres: faker.person.firstName(), apellidos: faker.person.lastName(), rol: 'COMERCIANTE' as const, authId: randomUUID(),
    })),
    skipDuplicates: true,
  });
  const usuarios = await prisma.usuario.findMany({ where: { email: { startsWith: `${prefijo}-comerciante-` } }, select: { id: true } });
  await prisma.comerciante.createMany({ data: usuarios.map((u, i) => ({ usuarioId: u.id, nombreComercial: `Comercio ${prefijo} ${i + 1}` })), skipDuplicates: true });
  const comerciantes = await prisma.comerciante.findMany({ where: { usuarioId: { in: usuarios.map((u) => u.id) } }, select: { id: true }, orderBy: { id: 'asc' } });
  let n = 0;
  await prisma.puesto.createMany({
    data: comerciantes.flatMap((c) => Array.from({ length: puestosPor }, () => ({ comercianteId: c.id, codigo: `${prefijo.toUpperCase()}-${String(++n).padStart(4, '0')}`, nombre: `Puesto ${faker.commerce.department()} ${n}` }))),
    skipDuplicates: true,
  });
  const puestos = await prisma.puesto.findMany({ where: { comercianteId: { in: comerciantes.map((c) => c.id) } }, select: { id: true } });
  const categorias = await prisma.categoria.findMany({ where: { slug: { startsWith: `${prefijo}-categoria-` } }, select: { id: true } });

  const productos = puestos.flatMap((p) =>
    Array.from({ length: productosPor }, () => ({
      puestoId: p.id,
      categoriaId: faker.helpers.arrayElement(categorias).id,
      nombre: `${faker.commerce.productName()} ${faker.number.int({ min: 1, max: 999 })}`,
      descripcion: faker.commerce.productDescription(),
      precio: new Prisma.Decimal(faker.commerce.price({ min: 0.5, max: 200, dec: 2 })),
      unidadVenta: faker.helpers.arrayElement(UNIDADES),
      presentacion: faker.helpers.maybe(() => `${faker.number.int({ min: 1, max: 5 })} ${faker.helpers.arrayElement(['kg', 'unidades', 'litros'])}`, { probability: 0.5 }) ?? null,
      estado: 'PUBLICADO' as const,
    })),
  );
  for (const lote of lotes(productos, 1000)) await prisma.producto.createMany({ data: lote });

  const [u, c, pu, ca, pr] = await Promise.all([
    prisma.usuario.count(), prisma.comerciante.count(), prisma.puesto.count(), prisma.categoria.count(), prisma.producto.count({ where: { estado: 'PUBLICADO' } }),
  ]);
  console.log(JSON.stringify({ base: `${host}`, usuarios: u, comerciantes: c, puestos: pu, categorias: ca, productosPublicados: pr, segundos: Math.round((Date.now() - t0) / 100) / 10 }));
} finally {
  await prisma.$disconnect();
}
