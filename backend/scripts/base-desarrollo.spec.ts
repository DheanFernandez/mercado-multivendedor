import { describe, expect, it } from 'vitest';
import { URL_DESARROLLO_POR_DEFECTO, evaluarBaseDesarrollo, exigirBaseDesarrollo, ocultarClave, urlDeDesarrollo } from './base-desarrollo.mjs';
import { URL_PRUEBAS_POR_DEFECTO } from './base-aislada.mjs';

/** Guarda del entorno de demostración (spec 004, E2; CA-DEMO-01). */
describe('base-desarrollo', () => {
  it('acepta solo la base local mercado_dev en el puerto 55434', () => {
    expect(evaluarBaseDesarrollo(URL_DESARROLLO_POR_DEFECTO)).toEqual({ ok: true });
    expect(evaluarBaseDesarrollo('postgresql://postgres:dev@localhost:55434/mercado_dev')).toEqual({ ok: true });
    expect(evaluarBaseDesarrollo('postgres://postgres:dev@[::1]:55434/mercado_dev')).toEqual({ ok: true });
  });

  it.each([
    ['Supabase (pooler)', 'postgresql://postgres.ref:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres', /remoto/],
    ['Supabase directo', 'postgresql://postgres:x@db.abcd.supabase.co:5432/postgres', /remoto/],
    ['la base de pruebas', URL_PRUEBAS_POR_DEFECTO, /puerto/],
    ['mercado_test en el puerto de demostración', 'postgresql://postgres:dev@127.0.0.1:55434/mercado_test', /no es «mercado_dev»/],
    ['otro puerto local (otro proyecto)', 'postgresql://postgres:x@127.0.0.1:55432/mercado_dev', /puerto/],
    ['un servidor de la red', 'postgresql://postgres:dev@192.168.1.20:55434/mercado_dev', /no es local/],
    ['el puerto por defecto', 'postgresql://postgres:dev@127.0.0.1/mercado_dev', /por defecto/],
    ['Prisma Postgres local', 'prisma+postgres://localhost:51213/?api_key=x', /protocolo/],
    ['una URL vacía', '', /no hay URL/],
  ])('rechaza %s', (_caso, url, motivo) => {
    const r = evaluarBaseDesarrollo(url);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(motivo);
    expect(() => exigirBaseDesarrollo(url)).toThrow(/ABORTADO por seguridad/);
  });

  it('usa DEV_DATABASE_URL o la URL por defecto, y nunca DATABASE_URL', () => {
    const supabase = 'postgresql://postgres.ref:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
    expect(urlDeDesarrollo({ DATABASE_URL: supabase })).toBe(URL_DESARROLLO_POR_DEFECTO);
    expect(urlDeDesarrollo({ DEV_DATABASE_URL: 'postgresql://postgres:otra@localhost:55434/mercado_dev' })).toBe('postgresql://postgres:otra@localhost:55434/mercado_dev');
    expect(() => urlDeDesarrollo({ DEV_DATABASE_URL: supabase })).toThrow(/ABORTADO/);
  });

  it('no muestra la contraseña en los mensajes', () => {
    expect(ocultarClave(URL_DESARROLLO_POR_DEFECTO)).toBe('postgresql://postgres:***@127.0.0.1:55434/mercado_dev');
    expect(() => exigirBaseDesarrollo('postgresql://u:secreta@db.supabase.co:5432/postgres')).toThrow(expect.objectContaining({ message: expect.not.stringContaining('secreta') }));
  });
});
