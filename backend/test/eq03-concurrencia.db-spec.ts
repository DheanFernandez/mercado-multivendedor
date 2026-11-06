/**
 * MEDICIÓN EQ-03 · Concurrencia: reserva simultánea del mismo stock (AC07). Procedimiento de
 * docs/05-implementacion/cumplimiento/03-matriz-de-mediciones.md §EQ-03, sin cambios:
 *   Serie 1: producto con stock físico 1; N clientes distintos (N = 2, 5 y 20); 100 iteraciones por N.
 *            En cada iteración: restablecer el stock, lanzar N reservas simultáneas (Promise.all) y verificar
 *            exactamente 1 éxito y N−1 respuestas controladas de falta de stock.
 *   Serie 2: stock S = 10 y 200 clientes; mismo criterio (exactamente S éxitos y 200−S faltas de stock).
 *   Comprobación SQL:  SELECT count(*) FROM inventarios WHERE stock_reservado > stock_fisico   → debe ser 0.
 * Umbral: 0 reservas incompatibles en el 100 % de las pruebas concurrentes.
 * Solo PostgreSQL local de Docker (guarda). Para guardar el resultado:  EVIDENCIA_DIR=<carpeta> npm run test:db -- test/eq03-concurrencia.db-spec.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StockInsuficienteError } from '../src/modules/inventory/domain/errors.js';
import { abrirBase, etiqueta, Fixtures, intentar, manana, reservadoSuperaFisico } from './helpers/inventario-db.js';

const ITERACIONES = 100;
const { prisma, reservar } = abrirBase();
const fx = new Fixtures(prisma, etiqueta());

interface Serie { nombre: string; clientes: number; stock: number; iteraciones: number; exitosEsperados: number; incorrectas: number; erroresNoControlados: number; reservasIncompatibles: number; msPorIteracionMediana: number; msPorIteracionMax: number }
const series: Serie[] = [];
let productoId = '';
let inventarioId = '';

beforeAll(async () => {
  await prisma.$connect();
  ({ productoId } = await fx.productoConStock(1));
  inventarioId = (await prisma.inventario.findUniqueOrThrow({ where: { productoId } })).id;
});
afterAll(async () => {
  await fx.limpiar();
  await prisma.$disconnect();
  const dir = process.env['EVIDENCIA_DIR'];
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  const total = series.reduce((s, x) => s + x.iteraciones, 0);
  const incompatibles = series.reduce((s, x) => s + x.reservasIncompatibles, 0);
  writeFileSync(join(dir, 'eq03-vitest.json'), JSON.stringify({
    medicion: 'EQ-03 · reserva simultánea del mismo stock (Vitest + PostgreSQL local)',
    umbral: '0 reservas incompatibles en el 100 % de las pruebas concurrentes',
    iteracionesTotales: total,
    iteracionesConResultadoCorrecto: series.reduce((s, x) => s + (x.iteraciones - x.incorrectas), 0),
    reservasIncompatibles: incompatibles,
    consultaSql: 'SELECT count(*) FROM inventarios WHERE stock_reservado > stock_fisico',
    series,
  }, null, 2));
});

/** Restablece el stock del producto y borra las reservas de la iteración anterior. */
async function restablecer(stock: number) {
  await prisma.$executeRaw`DELETE FROM reservas_inventario WHERE inventario_id = ${inventarioId}::uuid`;
  await prisma.$executeRaw`UPDATE inventarios SET stock_fisico = ${stock}::int, stock_reservado = 0 WHERE id = ${inventarioId}::uuid`;
}

async function medir(nombre: string, clientes: number, stock: number, iteraciones: number): Promise<Serie> {
  let incorrectas = 0;
  let noControlados = 0;
  let incompatibles = 0;
  const tiempos: number[] = [];
  for (let it = 0; it < iteraciones; it++) {
    await restablecer(stock);
    const t0 = performance.now();
    const res = await Promise.all(
      Array.from({ length: clientes }, (_, c) => intentar(() => reservar.ejecutar({ claveOperacion: `eq03-${nombre}-${it}-${c}`, items: [{ productoId, cantidad: 1 }], expiraEn: manana() }))),
    );
    tiempos.push(performance.now() - t0);
    const exitos = res.filter((r) => r.ok).length;
    const faltas = res.filter((r) => !r.ok && r.error instanceof StockInsuficienteError).length;
    noControlados += res.length - exitos - faltas;
    const [fila] = await prisma.$queryRaw<{ r: number; f: number }[]>`SELECT stock_reservado AS r, stock_fisico AS f FROM inventarios WHERE id = ${inventarioId}::uuid`;
    if (fila!.r > fila!.f) incompatibles++;
    if (exitos !== stock || faltas !== clientes - stock || fila!.r !== stock) incorrectas++;
  }
  tiempos.sort((a, b) => a - b);
  return {
    nombre, clientes, stock, iteraciones, exitosEsperados: stock, incorrectas, erroresNoControlados: noControlados, reservasIncompatibles: incompatibles,
    msPorIteracionMediana: Math.round(tiempos[Math.floor(tiempos.length / 2)]! * 10) / 10, msPorIteracionMax: Math.round(tiempos[tiempos.length - 1]! * 10) / 10,
  };
}

describe('EQ-03 · serie 1: stock físico 1, N clientes distintos, 100 iteraciones por N', () => {
  for (const n of [2, 5, 20]) {
    it(`N = ${n}: en las ${ITERACIONES} iteraciones, exactamente 1 éxito y ${n - 1} faltas de stock controladas`, async () => {
      const s = await medir(`N${n}`, n, 1, ITERACIONES);
      series.push(s);
      expect(s).toMatchObject({ incorrectas: 0, erroresNoControlados: 0, reservasIncompatibles: 0 });
    }, 240_000);
  }
});

describe('EQ-03 · serie 2: stock S = 10 y 200 clientes simultáneos', () => {
  it(`en ${ITERACIONES} iteraciones, exactamente 10 reservas aceptadas y 190 faltas de stock controladas`, async () => {
    const s = await medir('S10-200', 200, 10, ITERACIONES);
    series.push(s);
    expect(s).toMatchObject({ incorrectas: 0, erroresNoControlados: 0, reservasIncompatibles: 0 });
  }, 280_000);
});

describe('EQ-03 · comprobación SQL final', () => {
  it('SELECT count(*) FROM inventarios WHERE stock_reservado > stock_fisico  →  0 (toda la base de pruebas)', async () => {
    expect(await reservadoSuperaFisico(prisma)).toBe(0);
  });
});
