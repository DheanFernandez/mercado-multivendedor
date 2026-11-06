import { esAdministrador, type Actor } from '../../../../shared/domain/actor.js';
import { ErrorProhibido } from '../../../../shared/domain/errors.js';
import type { Comerciante } from '../../domain/comerciante.entity.js';
import { ComercianteInactivoError, ComercianteNoEncontradoError, PuestoNoEncontradoError } from '../../domain/errors.js';
import type { Puesto } from '../../domain/puesto.entity.js';
import type { ComercianteRepository, PuestoRepository } from '../ports/ports.js';
import { validarPaginacion } from './comerciantes.use-cases.js';

const exigirAdmin = (actor: Actor, mensaje: string) => {
  if (!esAdministrador(actor)) throw new ErrorProhibido(mensaje);
};

/** RF06 / HU22. Editar el nombre comercial. */
export class ActualizarComerciante {
  constructor(private readonly comerciantes: ComercianteRepository) {}

  async ejecutar(id: string, cambios: { nombreComercial?: unknown }, actor: Actor): Promise<Comerciante> {
    exigirAdmin(actor, 'Solo un administrador puede editar comerciantes.');
    const comerciante = await this.comerciantes.buscarPorId(id);
    if (!comerciante) throw new ComercianteNoEncontradoError();
    if (cambios.nombreComercial !== undefined) comerciante.renombrar(cambios.nombreComercial);
    await this.comerciantes.guardar(comerciante);
    return comerciante;
  }
}

/** RF06 / HU22. Suspender o reactivar (los productos de un comerciante suspendido salen del catálogo). */
export class CambiarEstadoComerciante {
  constructor(private readonly comerciantes: ComercianteRepository) {}

  async ejecutar(id: string, activo: unknown, actor: Actor): Promise<Comerciante> {
    exigirAdmin(actor, 'Solo un administrador puede suspender o reactivar comerciantes.');
    const comerciante = await this.comerciantes.buscarPorId(id);
    if (!comerciante) throw new ComercianteNoEncontradoError();
    comerciante.cambiarEstado(activo);
    await this.comerciantes.guardar(comerciante);
    return comerciante;
  }
}

/** RF07 / HU22. Editar código y nombre, o reasignar el puesto a otro comerciante activo. */
export class ActualizarPuesto {
  constructor(
    private readonly puestos: PuestoRepository,
    private readonly comerciantes: ComercianteRepository,
  ) {}

  async ejecutar(id: string, cambios: { codigo?: unknown; nombre?: unknown; comercianteId?: string }, actor: Actor): Promise<Puesto> {
    exigirAdmin(actor, 'Solo un administrador puede editar puestos.');
    const puesto = await this.puestos.buscarPorId(id);
    if (!puesto) throw new PuestoNoEncontradoError();
    if (cambios.comercianteId !== undefined && cambios.comercianteId !== puesto.comercianteId) {
      const destino = await this.comerciantes.buscarPorId(cambios.comercianteId);
      if (!destino) throw new ComercianteNoEncontradoError();
      if (!destino.activo) throw new ComercianteInactivoError();
    }
    puesto.actualizar(cambios);
    await this.puestos.guardar(puesto);
    return puesto;
  }
}

/** RF07 / HU22. Desactivar o reactivar un puesto. */
export class CambiarEstadoPuesto {
  constructor(private readonly puestos: PuestoRepository) {}

  async ejecutar(id: string, activo: unknown, actor: Actor): Promise<Puesto> {
    exigirAdmin(actor, 'Solo un administrador puede desactivar o reactivar puestos.');
    const puesto = await this.puestos.buscarPorId(id);
    if (!puesto) throw new PuestoNoEncontradoError();
    puesto.cambiarEstado(activo);
    await this.puestos.guardar(puesto);
    return puesto;
  }
}

/** Administrador o comerciante titular. */
export class ObtenerPuesto {
  constructor(
    private readonly puestos: PuestoRepository,
    private readonly comerciantes: ComercianteRepository,
  ) {}

  async ejecutar(id: string, actor: Actor): Promise<Puesto> {
    const puesto = await this.puestos.buscarPorId(id);
    if (esAdministrador(actor)) {
      if (!puesto) throw new PuestoNoEncontradoError();
      return puesto;
    }
    const propio = await this.comerciantes.buscarPorUsuarioId(actor.id);
    if (!puesto || !propio || puesto.comercianteId !== propio.id) throw new ErrorProhibido('No tiene permiso para consultar este puesto.');
    return puesto;
  }
}

/** Público (RF18): puestos activos con comerciante activo, para filtrar el catálogo. */
export class ListarPuestosPublicos {
  constructor(private readonly puestos: PuestoRepository) {}

  async ejecutar(opciones: { limite?: number; desplazamiento?: number } = {}): Promise<Puesto[]> {
    return this.puestos.listarOperativos(validarPaginacion(opciones.limite ?? 100, opciones.desplazamiento ?? 0));
  }
}
