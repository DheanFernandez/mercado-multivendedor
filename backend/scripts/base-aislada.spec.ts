import { describe, expect, it } from 'vitest';
import { URL_PRUEBAS_POR_DEFECTO, evaluarBaseAislada, exigirBaseAislada, urlDePruebas } from './base-aislada.mjs';

describe('guarda de la base aislada', () => {
  it('acepta únicamente la base local de pruebas', () => {
    expect(evaluarBaseAislada(URL_PRUEBAS_POR_DEFECTO).ok).toBe(true);
    expect(evaluarBaseAislada('postgresql://postgres:x@localhost:55433/mercado_test').ok).toBe(true);
    expect(evaluarBaseAislada('postgres://u:p@127.0.0.1:55433/mercado_test?schema=public').ok).toBe(true);
  });

  it.each([
    ['Supabase (conexión directa)', 'postgresql://postgres:x@db.abcdefgh.supabase.co:5432/postgres'],
    ['Supabase (pooler)', 'postgresql://postgres.abcd:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres'],
    ['Neon', 'postgresql://u:p@ep-cool-123.us-east-2.aws.neon.tech/neondb?sslmode=require'],
    ['servidor remoto cualquiera', 'postgresql://u:p@203.0.113.10:55433/mercado_test'],
    ['host que empieza como local', 'postgresql://u:p@localhost.evil.com:55433/mercado_test'],
    ['usuario falso con host remoto', 'postgresql://127.0.0.1@evil.com:55433/mercado_test'],
    ['la base de otro proyecto (puerto 55432)', 'postgresql://postgres:x@127.0.0.1:55432/mercado_test'],
    ['puerto estándar local', 'postgresql://postgres:x@127.0.0.1:5432/mercado_test'],
    ['otra base en el puerto correcto', 'postgresql://postgres:x@127.0.0.1:55433/postgres'],
    ['marcador remoto aunque el host sea local', 'postgresql://postgres:x@127.0.0.1:55433/mercado_test?host=db.supabase.co'],
    ['protocolo distinto', 'mysql://u:p@127.0.0.1:55433/mercado_test'],
    ['URL inválida', 'no es una url'],
    ['vacía', ''],
    ['indefinida', undefined],
  ])('rechaza %s', (_nombre, url) => {
    expect(evaluarBaseAislada(url).ok).toBe(false);
    expect(() => exigirBaseAislada(url)).toThrow(/ABORTADO por seguridad/);
  });

  it('el mensaje de error no revela contraseñas', () => {
    expect(() => exigirBaseAislada('postgresql://postgres:secreto123@db.x.supabase.co:5432/postgres')).not.toThrow(/secreto123/);
  });

  it('urlDePruebas ignora DATABASE_URL (que puede apuntar a Supabase) y usa TEST_DATABASE_URL o el valor local por defecto', () => {
    expect(urlDePruebas({ DATABASE_URL: 'postgresql://postgres:x@db.x.supabase.co:5432/postgres' })).toBe(URL_PRUEBAS_POR_DEFECTO);
    expect(urlDePruebas({ TEST_DATABASE_URL: 'postgresql://postgres:otra@127.0.0.1:55433/mercado_test' })).toContain('otra');
    expect(() => urlDePruebas({ TEST_DATABASE_URL: 'postgresql://postgres:x@db.x.supabase.co:5432/postgres' })).toThrow(/ABORTADO/);
  });
});
