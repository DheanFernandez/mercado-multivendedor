/**
 * Guarda del entorno de DEMOSTRACIÓN local (spec 004, E2; CA-DEMO-01). Las órdenes de `ops/demo/demo-db.mjs` (ping,
 * migraciones, seed, limpieza, verificación, vinculación y API de demostración) SOLO pueden usar la base `mercado_dev` del
 * contenedor local `mercado-dev-db` (127.0.0.1:55434). Rechaza Supabase, poolers, cualquier servidor remoto, la base de
 * pruebas (`mercado_test`, puerto 55433) y cualquier otra base. Mismo patrón que `base-aislada.mjs` (pruebas).
 */
export const HOST_PERMITIDOS = ['127.0.0.1', 'localhost', '[::1]'];
export const PUERTO_DESARROLLO = '55434';
export const BASE_DESARROLLO = 'mercado_dev';
/** Credenciales EXCLUSIVAMENTE locales del contenedor de demostración (ops/demo/docker-compose.yml); no son de ningún servicio. */
export const URL_DESARROLLO_POR_DEFECTO = `postgresql://postgres:dev@127.0.0.1:${PUERTO_DESARROLLO}/${BASE_DESARROLLO}`;
const REMOTAS = /supabase|neon\.tech|pooler|amazonaws|azure|render\.com|railway|aiven|cockroach|planetscale|timescale|elephantsql|heroku/i;

/** URL sin la contraseña, para mostrarla en la salida. */
export const ocultarClave = (url) => String(url).replace(/:[^:@/]*@/, ':***@');

/** @returns {{ ok: true } | { ok: false, motivo: string }} */
export function evaluarBaseDesarrollo(url) {
  if (typeof url !== 'string' || url.trim() === '') return { ok: false, motivo: 'no hay URL de base de datos' };
  if (REMOTAS.test(url)) return { ok: false, motivo: 'la URL menciona un proveedor remoto (Supabase, pooler u otro)' };
  let u;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, motivo: 'la URL no es válida' };
  }
  if (u.protocol !== 'postgresql:' && u.protocol !== 'postgres:') return { ok: false, motivo: 'el protocolo no es PostgreSQL' };
  if (!HOST_PERMITIDOS.includes(u.hostname)) return { ok: false, motivo: `el servidor «${u.hostname}» no es local (solo ${HOST_PERMITIDOS.join(', ')})` };
  if (u.port !== PUERTO_DESARROLLO) return { ok: false, motivo: `el puerto «${u.port || 'por defecto'}» no es el de la base de demostración (${PUERTO_DESARROLLO})` };
  if (u.pathname.replace(/^\//, '') !== BASE_DESARROLLO) return { ok: false, motivo: `la base de datos no es «${BASE_DESARROLLO}»` };
  return { ok: true };
}

/** Lanza un Error si la URL no es la de la base local de demostración; si no, la devuelve. */
export function exigirBaseDesarrollo(url) {
  const r = evaluarBaseDesarrollo(url);
  if (!r.ok) {
    throw new Error(
      `ABORTADO por seguridad: ${r.motivo}. El entorno de demostración solo usa la base local de Docker ` +
        `(${ocultarClave(URL_DESARROLLO_POR_DEFECTO)}). Inicie la base con «npm run db:dev:up» en backend/.`,
    );
  }
  return url;
}

/** URL de demostración: DEV_DATABASE_URL o la de por defecto. Nunca lee DATABASE_URL (que apunta a Supabase). */
export function urlDeDesarrollo(env = process.env) {
  return exigirBaseDesarrollo(env.DEV_DATABASE_URL && env.DEV_DATABASE_URL.trim() !== '' ? env.DEV_DATABASE_URL : URL_DESARROLLO_POR_DEFECTO);
}
