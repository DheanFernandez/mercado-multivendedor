import type { Rol } from '../../../../shared/domain/actor.js';
import type { UsuarioRepository } from '../ports/usuario.repository.js';

export interface ResumenUsuario {
  id: string;
  rol: Rol;
  activo: boolean;
}

/** API pública interna del módulo: otros módulos la usan sin conocer la persistencia ni la entidad. */
export class ObtenerResumenUsuario {
  constructor(private readonly usuarios: UsuarioRepository) {}

  async ejecutar(id: string): Promise<ResumenUsuario | null> {
    const u = await this.usuarios.buscarPorId(id);
    return u ? { id: u.id, rol: u.rol, activo: u.activo } : null;
  }
}
