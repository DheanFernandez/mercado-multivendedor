import type { Rol } from '../../../../shared/domain/actor.js';

/** Verifica un JWT emitido por el proveedor de identidad y devuelve su identidad. Lanza ErrorNoAutenticado si no es válido. */
export interface VerificadorToken {
  verificar(token: string): Promise<{ authId: string }>;
}

/** Resuelve el perfil local (rol y estado) a partir de la identidad. La fuente de verdad es PostgreSQL. */
export interface UsuarioPorAuthIdPort {
  buscar(authId: string): Promise<{ id: string; rol: Rol; activo: boolean } | null>;
}

export const VERIFICADOR_TOKEN = Symbol('VERIFICADOR_TOKEN');
export const USUARIO_POR_AUTH_ID = Symbol('USUARIO_POR_AUTH_ID');
