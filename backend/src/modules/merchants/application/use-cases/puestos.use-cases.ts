import { randomUUID } from 'node:crypto';
import { Rol, esAdministrador, type Actor } from '../../../../shared/domain/actor.js';
import { ErrorProhibido } from '../../../../shared/domain/errors.js';
import { ComercianteInactivoError, ComercianteNoEncontradoError } from '../../domain/errors.js';
import { Puesto } from '../../domain/puesto.entity.js';
import type { ComercianteRepository, PuestoRepository } from '../ports/ports.js';
import { validarPaginacion } from './comerciantes.use-cases.js';

/** RF07 / HU22. Solo el administrador registra puestos, asignados a un comerciante activo. */
export class RegistrarPuesto {
  constructor(
    private readonly puestos: PuestoRepository,
    private readonly comerciantes: ComercianteRepository,
  ) {}

  async ejecutar(comando: { comercianteId: string; codigo: string; nombre: string }, actor: Actor): Promise<Puesto> {
    if (!esAdministrador(actor)) throw new ErrorProhibido('Solo un administrador puede registrar puestos.');
    const puesto = Puesto.crear({ id: randomUUID(), ...comando });
    const comerciante = await this.comerciantes.buscarPorId(comando.comercianteId);
    if (!comerciante) throw new ComercianteNoEncontradoError();
    if (!comerciante.activo) throw new ComercianteInactivoError();
    await this.puestos.guardar(puesto);
    return puesto;
  }
}

/**
 * Administrador: todos los puestos (opcionalmente de un comerciante).
 * Comerciante: únicamente los puestos que tiene asignados (RF46, actores §5).
 */
export class ListarPuestos {
  constructor(
    private readonly puestos: PuestoRepository,
    private readonly comerciantes: ComercianteRepository,
  ) {}

  async ejecutar(actor: Actor, opciones: { comercianteId?: string; limite?: number; desplazamiento?: number } = {}): Promise<Puesto[]> {
    const paginacion = validarPaginacion(opciones.limite, opciones.desplazamiento);
    if (esAdministrador(actor)) return this.puestos.listar({ comercianteId: opciones.comercianteId, ...paginacion });
    if (actor.rol !== Rol.COMERCIANTE) throw new ErrorProhibido('No tiene permiso para listar puestos.');
    const propio = await this.comerciantes.buscarPorUsuarioId(actor.id);
    if (!propio) throw new ErrorProhibido('No tiene un perfil de comerciante.');
    if (opciones.comercianteId && opciones.comercianteId !== propio.id) {
      throw new ErrorProhibido('No puede consultar los puestos de otro comerciante.');
    }
    return this.puestos.listar({ comercianteId: propio.id, ...paginacion });
  }
}
