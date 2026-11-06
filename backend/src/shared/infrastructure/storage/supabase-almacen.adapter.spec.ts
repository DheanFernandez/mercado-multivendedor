import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { ErrorDeValidacion, ErrorServicioNoDisponible } from '../../domain/errors.js';
import { SupabaseAlmacenAdapter } from './supabase-almacen.adapter.js';

const SECRETA = 'sb_secret_valor_de_prueba_no_real';
const entorno: Record<string, string> = { SUPABASE_URL: 'https://proyecto.supabase.co/', SUPABASE_SERVICE_ROLE_KEY: SECRETA };
const config = (e: Record<string, string> = entorno) => ({ get: (k: string) => e[k] }) as unknown as ConfigService;

function http(status = 200) {
  const llamadas: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    llamadas.push({ url, init });
    return new Response('{}', { status });
  }) as unknown as typeof fetch;
  return { fn, llamadas };
}
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe('SupabaseAlmacenAdapter', () => {
  it('sube al bucket configurado con la clave de servicio, sin sobrescribir', async () => {
    const { fn, llamadas } = http();
    await new SupabaseAlmacenAdapter(config({ ...entorno, SUPABASE_STORAGE_BUCKET: 'imgs' }), fn).subir('abc/123.png', PNG, 'image/png');
    expect(llamadas[0].url).toBe('https://proyecto.supabase.co/storage/v1/object/imgs/abc/123.png');
    expect(llamadas[0].init.method).toBe('POST');
    const h = llamadas[0].init.headers as Record<string, string>;
    expect(h['apikey']).toBe(SECRETA);
    expect(h['x-upsert']).toBe('false');
    expect(h['Content-Type']).toBe('image/png');
  });

  it('usa el bucket "productos" por defecto y calcula la URL pública', () => {
    const a = new SupabaseAlmacenAdapter(config(), http().fn);
    expect(a.urlPublica('abc/123.png')).toBe('https://proyecto.supabase.co/storage/v1/object/public/productos/abc/123.png');
    expect(new SupabaseAlmacenAdapter(config({}), http().fn).urlPublica('a.png')).toBeNull();
  });

  it('la URL pública nunca incluye la clave de servicio', () => {
    expect(new SupabaseAlmacenAdapter(config(), http().fn).urlPublica('a/b.png')).not.toContain(SECRETA);
  });

  it('elimina enviando solo la ruta indicada', async () => {
    const { fn, llamadas } = http();
    await new SupabaseAlmacenAdapter(config(), fn).eliminar('abc/123.png');
    expect(llamadas[0].init.method).toBe('DELETE');
    expect(JSON.parse(llamadas[0].init.body as string)).toEqual({ prefixes: ['abc/123.png'] });
  });

  it('eliminar es de mejor esfuerzo: un fallo de red no lanza', async () => {
    const roto = (async () => { throw new Error('ECONNRESET'); }) as unknown as typeof fetch;
    await expect(new SupabaseAlmacenAdapter(config(), roto).eliminar('a/b.png')).resolves.toBeUndefined();
  });

  it('sin SUPABASE_SERVICE_ROLE_KEY o sin URL, subir falla de forma controlada (503) sin llamar a la red', async () => {
    const { fn, llamadas } = http();
    await expect(new SupabaseAlmacenAdapter(config({ SUPABASE_URL: entorno.SUPABASE_URL }), fn).subir('a/b.png', PNG, 'image/png')).rejects.toBeInstanceOf(ErrorServicioNoDisponible);
    await expect(new SupabaseAlmacenAdapter(config({ SUPABASE_SERVICE_ROLE_KEY: SECRETA }), fn).subir('a/b.png', PNG, 'image/png')).rejects.toBeInstanceOf(ErrorServicioNoDisponible);
    expect(llamadas).toHaveLength(0);
  });

  it('los errores no filtran la clave ni el detalle del proveedor', async () => {
    const rechaza = new SupabaseAlmacenAdapter(config(), http(403).fn);
    const e = await rechaza.subir('a/b.png', PNG, 'image/png').catch((x) => x as Error);
    expect(e).toBeInstanceOf(ErrorServicioNoDisponible);
    expect(String((e as Error).message)).not.toContain(SECRETA);
    const roto = (async () => { throw new Error(`fallo con ${SECRETA}`); }) as unknown as typeof fetch;
    const e2 = await new SupabaseAlmacenAdapter(config(), roto).subir('a/b.png', PNG, 'image/png').catch((x) => x as Error);
    expect(String((e2 as Error).message)).not.toContain(SECRETA);
  });

  it.each(['../secreto.png', 'a/../b.png', '/absoluta.png', 'a//b.png', '', 'a b.png', 'a/b.png?x=1'])('rechaza rutas peligrosas %j sin llamar a la red', async (ruta) => {
    const { fn, llamadas } = http();
    await expect(new SupabaseAlmacenAdapter(config(), fn).subir(ruta, PNG, 'image/png')).rejects.toBeInstanceOf(ErrorDeValidacion);
    expect(llamadas).toHaveLength(0);
  });
});
