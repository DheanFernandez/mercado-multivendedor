import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { ErrorNoAutenticado, ErrorServicioNoDisponible } from '../../../shared/domain/errors.js';
import type { VerificadorToken } from '../application/ports/ports.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Algoritmos permitidos: nunca "none". Asimétricos para JWKS; HS256 solo con el secreto legacy. */
const ALG_ASIMETRICOS = ['ES256', 'RS256', 'EdDSA'];

export interface OpcionesJose {
  issuer: string;
  audience: string;
  /** Resolutor de claves (JWKS) o secreto compartido (HS256 legacy). */
  clave: JWTVerifyGetKey | Uint8Array;
}

/** Verificación criptográfica local de JWT (firma, emisor, audiencia y expiración). */
export class JoseVerificadorToken implements VerificadorToken {
  constructor(private readonly opciones: OpcionesJose) {}

  async verificar(token: string): Promise<{ authId: string }> {
    try {
      const { clave, issuer, audience } = this.opciones;
      const resultado =
        clave instanceof Uint8Array
          ? await jwtVerify(token, clave, { issuer, audience, algorithms: ['HS256'] })
          : await jwtVerify(token, clave, { issuer, audience, algorithms: ALG_ASIMETRICOS });
      const { sub, role } = resultado.payload;
      // `role` de Supabase = "authenticated" para sesiones de usuario (descarta la clave anon).
      if (typeof sub !== 'string' || !UUID.test(sub) || role !== 'authenticated') throw new Error('claims');
      return { authId: sub };
    } catch {
      throw new ErrorNoAutenticado('Sesión inválida o expirada.');
    }
  }
}

/** Construye el verificador a partir del entorno al primer uso (la API arranca aunque Supabase no esté configurado). */
@Injectable()
export class SupabaseVerificadorToken implements VerificadorToken {
  private interno?: JoseVerificadorToken;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  private construir(): JoseVerificadorToken {
    const url = this.config.get<string>('SUPABASE_URL')?.replace(/\/+$/, '');
    if (!url) throw new ErrorServicioNoDisponible('El servicio de autenticación no está configurado.');
    const secreto = this.config.get<string>('SUPABASE_JWT_SECRET');
    return new JoseVerificadorToken({
      issuer: `${url}/auth/v1`,
      audience: 'authenticated',
      clave: secreto ? new TextEncoder().encode(secreto) : createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`)),
    });
  }

  verificar(token: string): Promise<{ authId: string }> {
    this.interno ??= this.construir();
    return this.interno.verificar(token);
  }
}
