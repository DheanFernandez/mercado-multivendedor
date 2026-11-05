import { SignJWT, UnsecuredJWT, generateKeyPair } from 'jose';
import { describe, expect, it } from 'vitest';
import { ErrorNoAutenticado } from '../../../shared/domain/errors.js';
import { JoseVerificadorToken } from './jose-verificador-token.js';

const ISSUER = 'https://proyecto.supabase.co/auth/v1';
const SUB = '11111111-1111-4111-8111-111111111111';

async function entorno() {
  const buena = await generateKeyPair('ES256');
  const otra = await generateKeyPair('ES256');
  const verificador = new JoseVerificadorToken({ issuer: ISSUER, audience: 'authenticated', clave: async () => buena.publicKey });
  const firmar = (claims: Record<string, unknown> = {}, opciones: { clave?: CryptoKey; iss?: string; aud?: string; exp?: string } = {}) =>
    new SignJWT({ role: 'authenticated', ...claims })
      .setProtectedHeader({ alg: 'ES256' })
      .setSubject(SUB)
      .setIssuer(opciones.iss ?? ISSUER)
      .setAudience(opciones.aud ?? 'authenticated')
      .setIssuedAt()
      .setExpirationTime(opciones.exp ?? '5m')
      .sign(opciones.clave ?? buena.privateKey);
  return { verificador, firmar, otra };
}

describe('JoseVerificadorToken', () => {
  it('acepta un JWT válido y devuelve el authId (sub)', async () => {
    const { verificador, firmar } = await entorno();
    await expect(verificador.verificar(await firmar())).resolves.toEqual({ authId: SUB });
  });

  it('acepta el secreto legacy HS256 cuando se configura', async () => {
    const secreto = new TextEncoder().encode('secreto-de-prueba-suficientemente-largo');
    const v = new JoseVerificadorToken({ issuer: ISSUER, audience: 'authenticated', clave: secreto });
    const token = await new SignJWT({ role: 'authenticated' }).setProtectedHeader({ alg: 'HS256' }).setSubject(SUB).setIssuer(ISSUER).setAudience('authenticated').setExpirationTime('5m').sign(secreto);
    await expect(v.verificar(token)).resolves.toEqual({ authId: SUB });
  });

  it.each([
    ['firmado con otra clave', async (e: Awaited<ReturnType<typeof entorno>>) => e.firmar({}, { clave: e.otra.privateKey })],
    ['expirado', async (e: Awaited<ReturnType<typeof entorno>>) => e.firmar({}, { exp: '-1m' })],
    ['emisor distinto', async (e: Awaited<ReturnType<typeof entorno>>) => e.firmar({}, { iss: 'https://otro.supabase.co/auth/v1' })],
    ['audiencia distinta', async (e: Awaited<ReturnType<typeof entorno>>) => e.firmar({}, { aud: 'otra' })],
    ['rol anon (clave pública)', async (e: Awaited<ReturnType<typeof entorno>>) => e.firmar({ role: 'anon' })],
    ['sin rol', async (e: Awaited<ReturnType<typeof entorno>>) => e.firmar({ role: undefined })],
    ['sub que no es UUID', async (e: Awaited<ReturnType<typeof entorno>>) =>
      new SignJWT({ role: 'authenticated' }).setProtectedHeader({ alg: 'ES256' }).setSubject('no-uuid').setIssuer(ISSUER).setAudience('authenticated').setExpirationTime('5m').sign(e.otra.privateKey)],
    ['alg "none" sin firma', async () => new UnsecuredJWT({ role: 'authenticated' }).setSubject(SUB).setIssuer(ISSUER).setAudience('authenticated').setExpirationTime('5m').encode()],
    ['basura', async () => 'esto.no.es-un-jwt'],
    ['vacío', async () => ''],
  ])('rechaza un token %s', async (_nombre, crear) => {
    const e = await entorno();
    await expect(e.verificador.verificar(await crear(e))).rejects.toBeInstanceOf(ErrorNoAutenticado);
  });

  it('rechaza HS256 cuando se espera una clave asimétrica (confusión de algoritmo)', async () => {
    const { verificador } = await entorno();
    const falso = await new SignJWT({ role: 'authenticated' }).setProtectedHeader({ alg: 'HS256' }).setSubject(SUB).setIssuer(ISSUER).setAudience('authenticated').setExpirationTime('5m').sign(new TextEncoder().encode('cualquier-secreto-de-32-bytes-o-mas!!'));
    await expect(verificador.verificar(falso)).rejects.toBeInstanceOf(ErrorNoAutenticado);
  });
});
