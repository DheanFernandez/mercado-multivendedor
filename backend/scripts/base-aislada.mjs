/**
 * Guarda de seguridad: las pruebas destructivas, de concurrencia y las mediciones SOLO pueden usar la base local de Docker
 * (`mercado-test-db`). Rechaza Supabase, Neon y cualquier base remota o distinta de la de pruebas del marketplace.
 * Única fuente de la regla: la usan el ejecutor (ops/medicion/test-db.mjs), la configuración de Vitest, las pruebas y el seed.
 */
export const HOST_PERMITIDOS = ['127.0.0.1', 'localhost', '[::1]'];
export const PUERTO_PRUEBAS = '55433';
export const BASE_PRUEBAS = 'mercado_test';
export const URL_PRUEBAS_POR_DEFECTO = `postgresql://postgres:test@127.0.0.1:${PUERTO_PRUEBAS}/${BASE_PRUEBAS}`;
const REMOTAS = /supabase|neon\.tech|pooler|amazonaws|azure|render\.com|railway|aiven|cockroach|planetscale|timescale|elephantsql|heroku/i;

/** @returns {{ ok: true } | { ok: false, motivo: string }} */
export function evaluarBaseAislada(url) {
  if (typeof url !== 'string' || url.trim() === '') return { ok: false, motivo: 'no hay URL de base de datos' };
  if (REMOTAS.test(url)) return { ok: false, motivo: 'la URL menciona un proveedor remoto (Supabase, Neon u otro)' };
  let u;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, motivo: 'la URL no es válida' };
  }
  if (u.protocol !== 'postgresql:' && u.protocol !== 'postgres:') return { ok: false, motivo: 'el protocolo no es PostgreSQL' };
  if (!HOST_PERMITIDOS.includes(u.hostname)) return { ok: false, motivo: `el servidor «${u.hostname}» no es local (solo ${HOST_PERMITIDOS.join(', ')})` };
  if (u.port !== PUERTO_PRUEBAS) return { ok: false, motivo: `el puerto «${u.port || 'por defecto'}» no es el de la base de pruebas (${PUERTO_PRUEBAS})` };
  if (u.pathname.replace(/^\//, '') !== BASE_PRUEBAS) return { ok: false, motivo: `la base de datos no es «${BASE_PRUEBAS}»` };
  return { ok: true };
}

/** Lanza un Error si la URL no es la de la base local de pruebas; si no, la devuelve. */
export function exigirBaseAislada(url) {
  const r = evaluarBaseAislada(url);
  if (!r.ok) {
    throw new Error(
      `ABORTADO por seguridad: ${r.motivo}. Las pruebas y mediciones solo pueden ejecutarse sobre la base local de Docker ` +
        `(${URL_PRUEBAS_POR_DEFECTO.replace(/:[^:@/]*@/, ':***@')}). Inicie la base con «npm run db:test:up» en backend/.`,
    );
  }
  return url;
}

/** URL de pruebas: TEST_DATABASE_URL o la de por defecto. Nunca lee DATABASE_URL (que puede apuntar a Supabase). */
export function urlDePruebas(env = process.env) {
  return exigirBaseAislada(env.TEST_DATABASE_URL && env.TEST_DATABASE_URL.trim() !== '' ? env.TEST_DATABASE_URL : URL_PRUEBAS_POR_DEFECTO);
}
