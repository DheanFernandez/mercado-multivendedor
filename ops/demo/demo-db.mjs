#!/usr/bin/env node
/**
 * Ejecutor del ENTORNO DE DEMOSTRACIÓN local (spec 004, E2). Se invoca desde backend/ con `npm run db:dev:*` y `npm run demo:api`.
 *
 *   up | ping | migrate | status | seed | fotos | verificar | limpiar | vincular | api | stop | down
 *
 * Seguridad (CA-DEMO-01): toda orden que se conecta pasa ANTES por la guarda `base-desarrollo.mjs` (solo 127.0.0.1:55434/
 * mercado_dev). Nunca lee DATABASE_URL del .env (Supabase) ni usa `migrate reset`/`db push`. Docker solo opera sobre el
 * proyecto `mercado-dev` (contenedor `mercado-dev-db`). La API de demostración se inicia sin claves que permitan escribir
 * en Supabase (Storage, registro e invitaciones devuelven 503). Las imágenes se leen del frontend local:
 * `ALMACEN_URL_PUBLICA` = origen del frontend (spec 004, E3), sin tocar `SUPABASE_URL` (verificación de sesiones).
 */
import { execSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUERTO_DESARROLLO, ocultarClave, urlDeDesarrollo } from '../../backend/scripts/base-desarrollo.mjs';
import { fotosAsociadas, inspeccionar, limpiar, recuentos, sembrar, sembrarFotos, vincular } from '../../backend/scripts/demo/operaciones-demo.mjs';
import { CARPETA_FOTOS } from '../../backend/scripts/demo/fotos-demo.mjs';
import { verificarApi } from '../../backend/scripts/demo/verificar-demo.mjs';
import { PREFIJO_ID } from '../../backend/scripts/demo/datos-demo.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const backend = join(raiz, 'backend');
const compose = join(raiz, 'ops', 'demo', 'docker-compose.yml');
const requerir = createRequire(join(backend, 'package.json'));
const CONTENEDOR = 'mercado-dev-db';
const carpetaFotos = join(raiz, CARPETA_FOTOS);
const [comando = 'ayuda', ...args] = process.argv.slice(2);

const opcion = (nombre, porDefecto) => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : porDefecto;
};
const sh = (cmd, { cwd = raiz, env = {} } = {}) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
const salida = (cmd) => execSync(cmd, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const docker = (a) => sh(`docker compose -f "${compose}" ${a}`);
const json = (x) => console.log(JSON.stringify(x, null, 2));

function exigirDocker() {
  try {
    execSync('docker info', { stdio: 'ignore' });
  } catch {
    throw new Error('Docker no responde. Inicie Docker Desktop y vuelva a intentarlo.');
  }
}

/** Ningún OTRO contenedor puede estar publicando el puerto de la base de demostración. */
function exigirPuertoDocker() {
  const ajenos = salida(`docker ps --filter publish=${PUERTO_DESARROLLO} --format "{{.Names}}"`).split(/\r?\n/).filter((n) => n && n !== CONTENEDOR);
  if (ajenos.length > 0) throw new Error(`ABORTADO: el puerto ${PUERTO_DESARROLLO} lo usa otro contenedor (${ajenos.join(', ')}); no se toca.`);
}

async function conBase(trabajo) {
  const url = urlDeDesarrollo(); // la guarda se evalúa ANTES de conectarse
  const pg = requerir('pg');
  const cliente = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000, application_name: 'mercado-demo-ops' });
  await cliente.connect();
  try {
    return await trabajo(cliente, url);
  } finally {
    await cliente.end();
  }
}

const puertoLibre = (puerto) =>
  new Promise((ok) => {
    const s = createServer()
      .once('error', () => ok(false))
      .once('listening', () => s.close(() => ok(true)))
      .listen(Number(puerto), '0.0.0.0');
  });

/**
 * Inicia la API compilada (dist/main) contra `mercado_dev`. El entorno del proceso tiene prioridad sobre backend/.env
 * (@nestjs/config y dotenv no sobrescriben variables definidas), así que DATABASE_URL apunta a la base local.
 */
async function iniciarApi({ url, puerto, frontend, imagenes = frontend, extra = {}, silenciosa = false }) {
  if (!existsSync(join(backend, 'dist', 'main.js'))) throw new Error('No existe backend/dist/main.js: ejecute «npm run build» en backend/.');
  if (!(await puertoLibre(puerto))) throw new Error(`El puerto ${puerto} está ocupado. Detenga lo que lo usa o elija otro con --puerto.`);
  const env = {
    ...process.env,
    DATABASE_URL: url,
    DIRECT_URL: url,
    PORT: String(puerto),
    FRONTEND_URL: frontend,
    // Sin claves de escritura en Supabase: Storage, registro e invitaciones responden 503 en la demostración.
    SUPABASE_SERVICE_ROLE_KEY: '',
    SUPABASE_ANON_KEY: '',
    MERCADOPAGO_ACCESS_TOKEN: '',
    MERCADOPAGO_WEBHOOK_SECRET: '',
    // Solo cambia el origen de LECTURA de las imágenes (spec 004, E3); SUPABASE_URL sigue verificando las sesiones.
    ALMACEN_URL_PUBLICA: imagenes,
    ...extra,
  };
  const registro = [];
  const hijo = spawn(process.execPath, ['--enable-source-maps', 'dist/main'], { cwd: backend, env, stdio: silenciosa ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
  if (silenciosa) for (const flujo of [hijo.stdout, hijo.stderr]) flujo.on('data', (d) => registro.push(String(d)));
  const base = `http://127.0.0.1:${puerto}`;
  const limite = Date.now() + 60_000;
  for (;;) {
    if (hijo.exitCode !== null) throw new Error(`La API terminó al iniciar (código ${hijo.exitCode}).\n${registro.join('').slice(-2000)}`);
    try {
      const r = await fetch(`${base}/api/v1/catalogo/productos?pagina=1&limite=50`);
      const cuerpo = await r.json();
      // Identidad de la base: solo mercado_dev contiene los productos de demostración.
      const ids = (cuerpo.datos ?? []).map((p) => p.id);
      if (r.status !== 200 || ids.length === 0 || !ids.every((id) => id.startsWith(PREFIJO_ID))) {
        hijo.kill();
        throw new Error(`ABORTADO: la API no sirve los datos de mercado_dev (HTTP ${r.status}, ${ids.length} productos). ¿Ejecutó «npm run db:dev:seed»?`);
      }
      return { hijo, base, total: cuerpo.total };
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('ABORTADO')) throw e;
      if (Date.now() > limite) {
        hijo.kill();
        throw new Error(`La API no respondió en 60 s.\n${registro.join('').slice(-2000)}`);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

const esperarInterrupcion = (hijo) =>
  new Promise((ok) => {
    const parar = () => {
      hijo.kill();
      ok();
    };
    process.once('SIGINT', parar);
    process.once('SIGTERM', parar);
    hijo.once('exit', ok);
  });

try {
  switch (comando) {
    case 'up':
      exigirDocker();
      exigirPuertoDocker();
      docker('config --quiet');
      docker('up -d --wait');
      break;

    case 'ping': {
      const url = urlDeDesarrollo();
      console.log(`URL (guarda superada): ${ocultarClave(url)}`);
      try {
        console.log(`Contenedor: ${salida(`docker ps --filter name=^${CONTENEDOR}$ --format "{{.Names}} · {{.Image}} · {{.Ports}} · {{.Status}}"`) || '(no listado)'}`);
      } catch {
        console.log('Contenedor: Docker no responde');
      }
      await conBase(async (db) => json(await inspeccionar(db)));
      break;
    }

    case 'migrate':
      await conBase(async (db, url) => {
        const info = await inspeccionar(db); // solo lectura, ANTES de escribir
        console.log(`Destino confirmado (solo lectura): base=${info.base} usuario=${info.usuario} puerto(interno)=${info.puerto_interno} PostgreSQL ${info.version} · tablas=${info.tablas} · migraciones=${info.migraciones ? info.migraciones.length : 'ninguna'}`);
        if (info.base !== 'mercado_dev') throw new Error('ABORTADO: la conexión no es mercado_dev.');
        if (info.tablas > 0 && !info.migraciones) throw new Error('ABORTADO sin cambios: la base contiene tablas sin registro de migraciones de Prisma. Revise su contenido antes de continuar.');
        console.log('Aplicando migraciones SOLO a mercado_dev (prisma migrate deploy; nunca reset)…');
        sh('npx prisma migrate deploy', { cwd: backend, env: { DATABASE_URL: url, DIRECT_URL: url } });
      });
      break;

    case 'status': {
      const url = urlDeDesarrollo();
      sh('npx prisma migrate status', { cwd: backend, env: { DATABASE_URL: url, DIRECT_URL: url } });
      break;
    }

    case 'seed':
      await conBase(async (db) => {
        const t0 = Date.now();
        const resultado = await sembrar(db);
        const fotografias = await sembrarFotos(db, carpetaFotos);
        json({ resultado, fotografias, recuentos: await recuentos(db), milisegundos: Date.now() - t0 });
      });
      break;

    case 'fotos':
      // Solo asocia o retira fotografías de demostración; no toca precios, usuarios, inventario ni carritos (CA-IMG-07).
      await conBase(async (db) => json({ carpeta: carpetaFotos, ...(await sembrarFotos(db, carpetaFotos)) }));
      break;

    case 'limpiar':
      await conBase(async (db) => json({ borrados: await limpiar(db), recuentos: await recuentos(db) }));
      break;

    case 'vincular':
      await conBase(async (db) => json(await vincular(db, { authId: opcion('auth-id'), email: opcion('email'), nombres: opcion('nombres'), apellidos: opcion('apellidos') })));
      break;

    case 'verificar': {
      const url = urlDeDesarrollo();
      const puerto = opcion('puerto', '3100');
      // Emisor de tokens LOCAL y secreto en memoria: no se contacta Supabase ni se crean cuentas (CA-DEMO-05).
      const emisor = 'http://127.0.0.1:54399';
      const secreto = randomBytes(32).toString('base64url');
      const { SignJWT } = requerir('jose');
      const firmarToken = (sub) =>
        new SignJWT({ role: 'authenticated' }).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setIssuer(`${emisor}/auth/v1`).setAudience('authenticated').setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(secreto));
      const frontend = opcion('frontend', 'http://localhost:3210');
      const imagenes = opcion('imagenes', frontend);
      const fotos = await conBase((db) => fotosAsociadas(db));
      const { hijo, base } = await iniciarApi({ url, puerto, frontend, imagenes, extra: { SUPABASE_URL: emisor, SUPABASE_JWT_SECRET: secreto }, silenciosa: true });
      console.log(`API de verificación en ${base} (base ${ocultarClave(url)}; imágenes en ${imagenes})`);
      let fallos = 0;
      try {
        const r = await verificarApi(base, { firmarToken, origenImagenes: imagenes, fotos, carpetaFotos });
        fallos = r.filter((x) => !x.ok).length;
        console.log(`\nResultado: ${r.length - fallos} de ${r.length} comprobaciones correctas.`);
      } finally {
        if (args.includes('--mantener') && fallos === 0) {
          console.log(`La API sigue en ${base} (Ctrl+C para detenerla).`);
          await esperarInterrupcion(hijo);
        } else hijo.kill();
      }
      if (fallos > 0) process.exitCode = 1;
      break;
    }

    case 'api': {
      const url = urlDeDesarrollo();
      const puerto = opcion('puerto', '3000');
      const frontend = opcion('frontend', 'http://localhost:3001');
      const imagenes = opcion('imagenes', frontend);
      const { hijo, base, total } = await iniciarApi({ url, puerto, frontend, imagenes });
      console.log(`\nAPI de DEMOSTRACIÓN en ${base} → base ${ocultarClave(url)} (${total} productos publicados). CORS: ${frontend}. Imágenes: ${imagenes}/demo/productos/. Ctrl+C para detenerla.`);
      await esperarInterrupcion(hijo);
      break;
    }

    case 'stop':
      exigirDocker();
      docker('stop');
      break;

    case 'down':
      exigirDocker();
      docker('down -v'); // elimina SOLO el contenedor, la red y el volumen de este proyecto
      break;

    default:
      console.log('Uso: node ops/demo/demo-db.mjs <up|ping|migrate|status|seed|fotos|verificar|limpiar|vincular|api|stop|down>');
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(e && typeof e.status === 'number' && e.status > 0 ? e.status : 1);
}
