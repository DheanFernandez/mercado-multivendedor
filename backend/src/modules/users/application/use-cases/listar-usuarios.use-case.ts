import { esAdministrador, type Actor } from '../../../../shared/domain/actor.js';
import { ErrorDeValidacion, ErrorProhibido } from '../../../../shared/domain/errors.js';
import type { Usuario } from '../../domain/usuario.entity.js';
import type { UsuarioRepository } from '../ports/usuario.repository.js';

/** HU21. Solo el administrador lista usuarios. */
export class ListarUsuarios {
  constructor(private readonly usuarios: UsuarioRepository) {}

  async ejecutar(actor: Actor, opciones: { limite?: number; desplazamiento?: number } = {}): Promise<Usuario[]> {
    if (!esAdministrador(actor)) throw new ErrorProhibido('Solo un administrador puede listar usuarios.');
    const limite = opciones.limite ?? 50;
    const desplazamiento = opciones.desplazamiento ?? 0;
    if (!Number.isInteger(limite) || limite < 1 || limite > 100) throw new ErrorDeValidacion('El límite debe estar entre 1 y 100.');
    if (!Number.isInteger(desplazamiento) || desplazamiento < 0) throw new ErrorDeValidacion('El desplazamiento no es válido.');
    return this.usuarios.listar({ limite, desplazamiento });
  }
}
