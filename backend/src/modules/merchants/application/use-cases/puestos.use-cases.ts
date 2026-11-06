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

export interface PuestoParaProductos {
  id: string;
  codigo: string;
  nombre: string;
  /** Puesto y comerciante activos: condición para publicar productos. */
  operativo: boolean;
  /** Usuario titular (comerciante) del puesto: base de la autorización por propiedad. */
  usuarioIdTitular: string;
}

/** API pública interna del módulo: datos mínimos de un puesto para que otros módulos autoricen por propiedad. */
export class ObtenerPuestoParaProductos {
  constructor(
    private readonly puestos: PuestoRepository,
    private readonly comerciantes: ComercianteRepository,
  ) {}

  async ejecutar(puestoId: string): Promise<PuestoParaProductos | null> {
    const puesto = await this.puestos.buscarPorId(puestoId);
    if (!puesto) return null;
    const comerciante = await this.comerciantes.buscarPorId(puesto.comercianteId);
    if (!comerciante) return null;
    return {
      id: puesto.id,
      codigo: puesto.codigo,
      nombre: puesto.nombre,
      operativo: puesto.estado === 'ACTIVO' && comerciante.activo,
      usuarioIdTitular: comerciante.usuarioId,
    };
  }
}

/** Ids de los puestos de un usuario comerciante (vacío si no tiene perfil). */
export class ListarIdsPuestosDeTitular {
  constructor(
    private readonly puestos: PuestoRepository,
    private readonly comerciantes: ComercianteRepository,
  ) {}

  async ejecutar(usuarioId: string): Promise<string[]> {
    const propio = await this.comerciantes.buscarPorUsuarioId(usuarioId);
    if (!propio) return [];
    return (await this.puestos.listar({ comercianteId: propio.id, limite: 100, desplazamiento: 0 })).map((p) => p.id);
  }
}
