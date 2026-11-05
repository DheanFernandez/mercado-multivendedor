import { esAdministrador, type Actor } from '../../../../shared/domain/actor.js';
import { ErrorProhibido } from '../../../../shared/domain/errors.js';
import { UsuarioNoEncontradoError } from '../../domain/errors.js';
import type { Usuario } from '../../domain/usuario.entity.js';
import type { UsuarioRepository } from '../ports/usuario.repository.js';

/** RF03. Un usuario puede consultar su propio perfil; el administrador puede consultar cualquiera. */
export class ConsultarUsuario {
  constructor(private readonly usuarios: UsuarioRepository) {}

  async ejecutar(id: string, actor: Actor): Promise<Usuario> {
    if (!esAdministrador(actor) && actor.id !== id) {
      throw new ErrorProhibido('No tiene permiso para consultar este usuario.');
    }
    const usuario = await this.usuarios.buscarPorId(id);
    if (!usuario) throw new UsuarioNoEncontradoError();
    return usuario;
  }
}
