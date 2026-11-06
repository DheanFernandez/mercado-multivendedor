#!/usr/bin/env node
/**
 * Ejecutor de la base de pruebas aislada. Se invoca desde backend/ con los scripts `npm run db:test:*` y `npm run test:db`.
 *   up | stop | down | status | migrate | ping | test | all
 * Siempre opera sobre el contenedor `mercado-test-db` (proyecto Docker `mercado-test`); no toca otros contenedores.
 * Todas las operaciones con Prisma/pruebas pasan antes por la guarda: solo la base local 127.0.0.1:55433/mercado_test.
 * MERCADO_TEST_DB_EXTERNA=1 omite Docker (para CI, donde la base es un servicio del flujo con la misma dirección).
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exigirBaseAislada, urlDePruebas } from '../../backend/scripts/base-aislada.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const backend = join(raiz, 'backend');
const compose = join(raiz, 'ops', 'medicion', 'docker-compose.yml');
const externa = process.env.MERCADO_TEST_DB_EXTERNA === '1';
const [comando = 'ayuda', ...extra] = process.argv.slice(2);

const sh = (cmd, { cwd = raiz, env = {} } = {}) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
const docker = (args) => sh(`docker compose -f "${compose}" ${args}`);
const entorno = (url) => ({ DATABASE_URL: url, DIRECT_URL: url, TEST_DATABASE_URL: url });

function levantar() {
  if (externa) return console.log('Base externa (CI): no se usa Docker.');
  try {
    execSync('docker info', { stdio: 'ignore' });
  } catch {
    throw new Error('Docker no responde. Inicie Docker Desktop y vuelva a intentarlo.');
  }
  docker('config --quiet');
  docker('up -d --wait');
}

function migrar() {
  const url = urlDePruebas();
  console.log('Aplicando migraciones SOLO a la base local de pruebas…');
  sh('npx prisma generate', { cwd: backend, env: entorno(url) });
  sh('npx prisma migrate deploy', { cwd: backend, env: entorno(url) }); // nunca «migrate reset»
}

async function ping() {
  const url = urlDePruebas();
  const pg = createRequire(join(backend, 'package.json'))('pg');
  const cliente = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  await cliente.connect();
  const { rows } = await cliente.query('select current_database() as base, current_user as usuario, inet_server_port() as puerto, split_part(version(), \' \', 2) as version');
  await cliente.end();
  console.log(`Conexión correcta: base=${rows[0].base} usuario=${rows[0].usuario} puerto(interno)=${rows[0].puerto} PostgreSQL ${rows[0].version}`);
  exigirBaseAislada(url);
}

try {
  switch (comando) {
    case 'up':
      levantar();
      break;
    case 'stop':
      if (!externa) docker('stop');
      break;
    case 'down':
      if (!externa) docker('down -v'); // elimina SOLO el contenedor, la red y el volumen de este proyecto
      break;
    case 'status':
      if (!externa) docker('ps');
      sh('npx prisma migrate status', { cwd: backend, env: entorno(urlDePruebas()) });
      break;
    case 'migrate':
      migrar();
      break;
    case 'ping':
      await ping();
      break;
    case 'test':
    case 'all': {
      const url = urlDePruebas(); // la guarda se evalúa ANTES de cualquier acción
      levantar();
      migrar();
      sh(`npx vitest run --config ./vitest.config.db.ts ${extra.join(' ')}`, { cwd: backend, env: entorno(url) });
      break;
    }
    default:
      console.log('Uso: node ops/medicion/test-db.mjs <up|stop|down|status|migrate|ping|test|all>');
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(e && typeof e.status === 'number' && e.status > 0 ? e.status : 1);
}
