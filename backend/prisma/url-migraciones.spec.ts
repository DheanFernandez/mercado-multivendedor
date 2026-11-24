import { resolverUrlMigraciones } from './url-migraciones';

const LOCAL = 'postgresql://postgres:test@127.0.0.1:55433/mercado_test';
const SESSION = 'postgresql://u:p@aws-0-x.pooler.supabase.com:5432/postgres';
const TRANSACTION = 'postgresql://u:p@aws-0-x.pooler.supabase.com:6543/postgres';

describe('resolverUrlMigraciones', () => {
  it('usa DIRECT_URL cuando está definida, aunque DATABASE_URL sea el pooler', () => {
    expect(resolverUrlMigraciones({ DIRECT_URL: SESSION, DATABASE_URL: TRANSACTION })).toBe(SESSION);
  });

  it('cae a DATABASE_URL local si falta DIRECT_URL', () => {
    expect(resolverUrlMigraciones({ DATABASE_URL: LOCAL })).toBe(LOCAL);
  });

  it('lanza un error claro si falta DIRECT_URL y DATABASE_URL usa el puerto 6543', () => {
    expect(() => resolverUrlMigraciones({ DATABASE_URL: TRANSACTION })).toThrow(/DIRECT_URL.*5432/s);
  });

  it('lanza un error si falta DIRECT_URL y DATABASE_URL contiene pgbouncer=true', () => {
    expect(() => resolverUrlMigraciones({ DATABASE_URL: `${LOCAL}?pgbouncer=true` })).toThrow(/DIRECT_URL/);
    expect(() => resolverUrlMigraciones({ DATABASE_URL: `${SESSION}?sslmode=require&pgbouncer=true` })).toThrow(
      /DIRECT_URL/,
    );
  });

  it('no lanza error en comandos sin conexión (generate, validate)', () => {
    expect(resolverUrlMigraciones({ DATABASE_URL: TRANSACTION }, { requiereConexion: false })).toBe(TRANSACTION);
  });

  it('devuelve undefined si no hay ninguna variable', () => {
    expect(resolverUrlMigraciones({})).toBeUndefined();
  });
});
