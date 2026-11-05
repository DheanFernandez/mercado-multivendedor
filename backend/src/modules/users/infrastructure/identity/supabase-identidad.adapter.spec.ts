import { describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { ErrorDeValidacion, ErrorServicioNoDisponible } from '../../../../shared/domain/errors.js';
import { IdentidadYaExisteError } from '../../domain/errors.js';
import { SupabaseIdentidadAdapter } from './supabase-identidad.adapter.js';

const entorno: Record<string, string> = {
  SUPABASE_URL: 'https://proyecto.supabase.co/',
  SUPABASE_ANON_KEY: 'sb_publishable_prueba',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_prueba',
  FRONTEND_URL: 'http://localhost:3001',
};
const config = (e: Record<string, string> = entorno) => ({ get: (k: string) => e[k] }) as unknown as ConfigService;

function http(status: number, cuerpo: unknown) {
  const llamadas: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    llamadas.push({ url, init });
    return new Response(JSON.stringify(cuerpo), { status });
  }) as unknown as typeof fetch;
  return { fn, llamadas };
}

describe('SupabaseIdentidadAdapter', () => {
  it('registrar usa la clave pública (nunca la de servicio) y redirige al callback del frontend', async () => {
    const { fn, llamadas } = http(200, { id: 'abc', identities: [{}] });
    const r = await new SupabaseIdentidadAdapter(config(), fn).registrar('a@b.co', 'clave-segura-1');
    expect(r).toEqual({ authId: 'abc' });
    expect(llamadas[0].url).toBe('https://proyecto.supabase.co/auth/v1/signup?redirect_to=http%3A%2F%2Flocalhost%3A3001%2Fauth%2Fcallback');
    expect((llamadas[0].init.headers as Record<string, string>)['apikey']).toBe('sb_publishable_prueba');
    expect(JSON.stringify(llamadas[0].init.headers)).not.toContain('sb_secret_prueba');
  });

  it('un usuario ofuscado sin identidades significa correo ya existente', async () => {
    const { fn } = http(200, { id: 'fantasma', identities: [] });
    await expect(new SupabaseIdentidadAdapter(config(), fn).registrar('a@b.co', 'clave-segura-1')).rejects.toBeInstanceOf(IdentidadYaExisteError);
  });

  it.each([
    [422, { error_code: 'user_already_exists', msg: 'x' }, IdentidadYaExisteError],
    [422, { error_code: 'weak_password', msg: 'Contraseña débil' }, ErrorDeValidacion],
    [500, { msg: 'boom' }, ErrorServicioNoDisponible],
    [429, { error_code: 'over_email_send_rate_limit' }, ErrorServicioNoDisponible],
  ])('traduce el error %# del proveedor', async (status, cuerpo, clase) => {
    const { fn } = http(status, cuerpo);
    await expect(new SupabaseIdentidadAdapter(config(), fn).registrar('a@b.co', 'clave-segura-1')).rejects.toBeInstanceOf(clase);
  });

  it('invitar y eliminar usan la clave de servicio (solo backend)', async () => {
    const inv = http(200, { id: 'inv-1' });
    await expect(new SupabaseIdentidadAdapter(config(), inv.fn).invitar('a@b.co')).resolves.toEqual({ authId: 'inv-1' });
    expect((inv.llamadas[0].init.headers as Record<string, string>)['apikey']).toBe('sb_secret_prueba');
    const del = http(200, {});
    await new SupabaseIdentidadAdapter(config(), del.fn).eliminar('inv-1');
    expect(del.llamadas[0].url).toBe('https://proyecto.supabase.co/auth/v1/admin/users/inv-1');
    expect(del.llamadas[0].init.method).toBe('DELETE');
  });

  it('falla de forma controlada si el servicio no está configurado', async () => {
    const { fn } = http(200, {});
    await expect(new SupabaseIdentidadAdapter(config({}), fn).registrar('a@b.co', 'x')).rejects.toBeInstanceOf(ErrorServicioNoDisponible);
    await expect(new SupabaseIdentidadAdapter(config({ SUPABASE_URL: 'https://p.supabase.co', SUPABASE_ANON_KEY: 'k' }), fn).invitar('a@b.co')).rejects.toBeInstanceOf(ErrorServicioNoDisponible);
  });

  it('un fallo de red se informa sin filtrar detalles', async () => {
    const roto = (async () => { throw new Error('ECONNRESET clave=sb_secret'); }) as unknown as typeof fetch;
    await expect(new SupabaseIdentidadAdapter(config(), roto).registrar('a@b.co', 'x')).rejects.toThrow('No se pudo contactar al servicio de autenticación.');
  });
});
