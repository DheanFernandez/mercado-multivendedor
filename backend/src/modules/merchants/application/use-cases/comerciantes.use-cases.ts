import { randomUUID } from 'node:crypto';
import { Rol, esAdministrador, type Actor } from '../../../../shared/domain/actor.js';
import { ErrorDeValidacion, ErrorProhibido } from '../../../../shared/domain/errors.js';
import { Comerciante } from '../../domain/comerciante.entity.js';
import {
  ComercianteNoEncontradoError,
  ComercianteYaRegistradoError,
  UsuarioNoEncontradoParaComercianteError,
  UsuarioNoEsComercianteError,
} from '../../domain/errors.js';
import type { ComercianteRepository, UsuarioConsultaPort } from '../ports/ports.js';

export function validarPaginacion(limite = 50, desplazamiento = 0): { limite: number; desplazamiento: number } {
  if (!Number.isInteger(limite) || limite < 1 || limite > 100) throw new ErrorDeValidacion('El límite debe estar entre 1 y 100.');
  if (!Number.isInteger(desplazamiento) || desplazamiento < 0) throw new ErrorDeValidacion('El desplazamiento no es válido.');
  return { limite, desplazamiento };
}

/** RF06 / HU22. Solo el administrador registra comerciantes, sobre un usuario existente con rol COMERCIANTE. */
export class RegistrarComerciante {
  constructor(
    private readonly comerciantes: ComercianteRepository,
    private readonly usuarios: UsuarioConsultaPort,
  ) {}

  async ejecutar(comando: { usuarioId: string; nombreComercial: string }, actor: Actor): Promise<Comerciante> {
    if (!esAdministrador(actor)) throw new ErrorProhibido('Solo un administrador puede registrar comerciantes.');
    const comerciante = Comerciante.crear({ id: randomUUID(), ...comando });
    const usuario = await this.usuarios.obtenerResumen(comando.usuarioId);
    if (!usuario) throw new UsuarioNoEncontradoParaComercianteError();
    if (usuario.rol !== Rol.COMERCIANTE || !usuario.activo) throw new UsuarioNoEsComercianteError();
    if (await this.comerciantes.buscarPorUsuarioId(usuario.id)) throw new ComercianteYaRegistradoError();
    await this.comerciantes.guardar(comerciante);
    return comerciante;
  }
}

/** Administrador, o el propio comerciante titular. */
export class ConsultarComerciante {
  constructor(private readonly comerciantes: ComercianteRepository) {}

  async ejecutar(id: string, actor: Actor): Promise<Comerciante> {
    const comerciante = await this.comerciantes.buscarPorId(id);
    if (!comerciante) {
      // No revelar la existencia de comerciantes ajenos a quien no es administrador.
      if (!esAdministrador(actor)) throw new ErrorProhibido('No tiene permiso para consultar este comerciante.');
      throw new ComercianteNoEncontradoError();
    }
    if (!esAdministrador(actor) && comerciante.usuarioId !== actor.id) {
      throw new ErrorProhibido('No tiene permiso para consultar este comerciante.');
    }
    return comerciante;
  }
}

export class ListarComerciantes {
  constructor(private readonly comerciantes: ComercianteRepository) {}

  async ejecutar(actor: Actor, opciones: { limite?: number; desplazamiento?: number } = {}): Promise<Comerciante[]> {
    if (!esAdministrador(actor)) throw new ErrorProhibido('Solo un administrador puede listar comerciantes.');
    return this.comerciantes.listar(validarPaginacion(opciones.limite, opciones.desplazamiento));
  }
}
