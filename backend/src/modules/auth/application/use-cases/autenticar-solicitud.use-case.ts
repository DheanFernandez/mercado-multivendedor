import type { Actor } from '../../../../shared/domain/actor.js';
import { ErrorProhibido } from '../../../../shared/domain/errors.js';
import type { UsuarioPorAuthIdPort, VerificadorToken } from '../ports/ports.js';

/**
 * RF02/RF03. Convierte un JWT en un Actor. El rol se lee SIEMPRE de PostgreSQL;
 * ningún dato del token (ni del frontend) define permisos.
 */
export class AutenticarSolicitud {
  constructor(
    private readonly verificador: VerificadorToken,
    private readonly usuarios: UsuarioPorAuthIdPort,
  ) {}

  async ejecutar(token: string): Promise<Actor> {
    const { authId } = await this.verificador.verificar(token); // lanza ErrorNoAutenticado
    const usuario = await this.usuarios.buscar(authId);
    if (!usuario) throw new ErrorProhibido('Su cuenta no está vinculada a un perfil de la plataforma.');
    if (!usuario.activo) throw new ErrorProhibido('Su cuenta está desactivada.');
    return { id: usuario.id, rol: usuario.rol };
  }
}
