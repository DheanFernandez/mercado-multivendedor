#!/usr/bin/env node
/**
 * Cobertura GLOBAL del backend (spec 006): pruebas unitarias + pruebas HTTP, con la definición única de
 * `vitest.cobertura.ts`. Cada suite se ejecuta con `--reporter=blob` y los resultados se unen con `--merge-reports`
 * (la forma soportada de combinar ejecuciones con configuraciones distintas).
 *
 *   coverage/unitarias/   resumen JSON de las unitarias (solo informativo)
 *   coverage/e2e/         resumen JSON de las pruebas HTTP (solo informativo)
 *   coverage/global/      INFORME COMBINADO: texto, HTML, LCOV y JSON; aquí se aplican los umbrales
 *
 * Las pruebas HTTP usan repositorios en memoria. `app.e2e-spec.ts` solo necesita que DATABASE_URL exista, así que el script
 * fija una URL FICTICIA sin servidor (127.0.0.1:1): nunca se usa una base real aunque exista `backend/.env`.
 *
 * No incluye `test:db` (PostgreSQL) ni Playwright.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Umbrales de la ejecución combinada (spec 006, D9 y CA-COV-06). Medido el 2026-11-18: 73,52 % sentencias, 70,73 % ramas,
 * 78,07 % funciones y 76,01 % líneas. Se fijan 3 a 3,5 puntos por debajo para detectar regresiones sin fallar por variaciones menores.
 */
export const UMBRALES = { statements: 70, branches: 67, functions: 75, lines: 73 };

const backend = join(dirname(fileURLToPath(import.meta.url)), '..');
const vitest = join(backend, 'node_modules', 'vitest', 'vitest.mjs');
const ficticia = 'postgresql://nadie:nada@127.0.0.1:1/inexistente';
const env = { ...process.env, DATABASE_URL: ficticia, DIRECT_URL: ficticia };

if (!existsSync(vitest)) {
  console.error('No se encuentra vitest: ejecute «npm ci» en backend/.');
  process.exit(1);
}
for (const d of ['blobs', 'unitarias', 'e2e', 'global']) rmSync(join(backend, 'coverage', d), { recursive: true, force: true });

function paso(titulo, args) {
  console.log(`\n══ ${titulo}`);
  const r = spawnSync(process.execPath, [vitest, 'run', ...args], { cwd: backend, env, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`\nFalló el paso «${titulo}» (código ${r.status}).`);
    process.exit(r.status ?? 1);
  }
}

const resumen = (d) => ['--coverage', `--coverage.reportsDirectory=coverage/${d}`, '--coverage.reporter=json-summary'];
paso('1/3 · Pruebas unitarias', [...resumen('unitarias'), '--reporter=blob', '--outputFile=coverage/blobs/unitarias.json']);
paso('2/3 · Pruebas HTTP', ['--config', './vitest.config.e2e.ts', ...resumen('e2e'), '--reporter=blob', '--outputFile=coverage/blobs/e2e.json']);
paso('3/3 · Informe combinado', [
  '--merge-reports=coverage/blobs',
  '--coverage',
  '--coverage.reportsDirectory=coverage/global',
  '--coverage.reporter=text',
  '--coverage.reporter=html',
  '--coverage.reporter=lcov',
  '--coverage.reporter=json-summary',
  ...Object.entries(UMBRALES).map(([k, v]) => `--coverage.thresholds.${k}=${v}`),
]);
console.log('\nInforme combinado en backend/coverage/global/ (index.html, lcov.info, coverage-summary.json).');
