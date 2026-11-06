import { Rol, esAdministrador, type Actor } from '../../../../shared/domain/actor.js';
import { ErrorDeValidacion, ErrorProhibido } from '../../../../shared/domain/errors.js';
import { UsuarioNoEncontradoError } from '../../domain/errors.js';
import type { Usuario } from '../../domain/usuario.entity.js';
import type { UsuarioRepository } from '../ports/usuario.repository.js';

/** Solo el administrador, y nunca sobre su propia cuenta (evita quedarse sin acceso o sin administradores). */
async function cargarGestionable(usuarios: UsuarioRepository, id: string, actor: Actor): Promise<Usuario> {
  if (!esAdministrador(actor)) throw new ErrorProhibido('Solo un administrador puede gestionar usuarios.');
  if (actor.id === id) throw new ErrorProhibido('No puede modificar su propia cuenta.');
  const usuario = await usuarios.buscarPorId(id);
  if (!usuario) throw new UsuarioNoEncontradoError();
  return usuario;
}

/** HU21. Activar o desactivar el acceso de un usuario. */
export class CambiarEstadoUsuario {
  constructor(private readonly usuarios: UsuarioRepository) {}

  async ejecutar(id: string, activo: unknown, actor: Actor): Promise<Usuario> {
    const usuario = await cargarGestionable(this.usuarios, id, actor);
    usuario.cambiarEstado(activo);
    await this.usuarios.guardar(usuario);
    return usuario;
  }
}

/** RF05 / HU21. Cambiar el rol almacenado en PostgreSQL (nunca se toma del token ni del frontend). */
export class CambiarRolUsuario {
  constructor(private readonly usuarios: UsuarioRepository) {}

  async ejecutar(id: string, rol: unknown, actor: Actor): Promise<Usuario> {
    if (typeof rol !== 'string' || !(Object.values(Rol) as string[]).includes(rol)) {
      if (!esAdministrador(actor)) throw new ErrorProhibido('Solo un administrador puede gestionar usuarios.');
      throw new ErrorDeValidacion('El rol no es válido.');
    }
    const usuario = await cargarGestionable(this.usuarios, id, actor);
    usuario.cambiarRol(rol as Rol);
    await this.usuarios.guardar(usuario);
    return usuario;
  }
}
