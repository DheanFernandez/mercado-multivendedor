import type { Rol } from '../../../../shared/domain/actor.js';
import type { UsuarioRepository } from '../ports/usuario.repository.js';

export interface UsuarioAutenticado {
  id: string;
  rol: Rol;
  activo: boolean;
}

/** API pública interna: el módulo de autenticación resuelve rol y estado desde PostgreSQL. */
export class ResolverUsuarioPorAuthId {
  constructor(private readonly usuarios: UsuarioRepository) {}

  async ejecutar(authId: string): Promise<UsuarioAutenticado | null> {
    const u = await this.usuarios.buscarPorAuthId(authId);
    return u ? { id: u.id, rol: u.rol, activo: u.activo } : null;
  }
}
