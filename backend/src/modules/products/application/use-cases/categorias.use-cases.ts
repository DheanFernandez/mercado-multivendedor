import { randomUUID } from 'node:crypto';
import { esAdministrador, type Actor } from '../../../../shared/domain/actor.js';
import { ErrorProhibido } from '../../../../shared/domain/errors.js';
import { Categoria } from '../../domain/categoria.entity.js';
import { CategoriaNoEncontradaError } from '../../domain/errors.js';
import type { CategoriaRepository } from '../ports/ports.js';

const exigirAdmin = (actor: Actor) => {
  if (!esAdministrador(actor)) throw new ErrorProhibido('Solo un administrador puede gestionar categorías.');
};

/** RF10. La documentación no asigna la gestión de categorías a otro actor: la realiza el administrador. */
export class CrearCategoria {
  constructor(private readonly categorias: CategoriaRepository) {}
  async ejecutar(comando: { nombre: string; descripcion?: string | null }, actor: Actor): Promise<Categoria> {
    exigirAdmin(actor);
    const categoria = Categoria.crear({ id: randomUUID(), nombre: comando.nombre, descripcion: comando.descripcion });
    await this.categorias.guardar(categoria);
    return categoria;
  }
}

export class ActualizarCategoria {
  constructor(private readonly categorias: CategoriaRepository) {}
  async ejecutar(id: string, cambios: { nombre?: string; descripcion?: string | null }, actor: Actor): Promise<Categoria> {
    exigirAdmin(actor);
    const categoria = await this.categorias.buscarPorId(id);
    if (!categoria) throw new CategoriaNoEncontradaError();
    categoria.actualizar(cambios);
    await this.categorias.guardar(categoria);
    return categoria;
  }
}

/** Activar/desactivar. Una categoría inactiva oculta sus productos del catálogo y no admite productos nuevos. */
export class CambiarDisponibilidadCategoria {
  constructor(private readonly categorias: CategoriaRepository) {}
  async ejecutar(id: string, activa: boolean, actor: Actor): Promise<Categoria> {
    exigirAdmin(actor);
    const categoria = await this.categorias.buscarPorId(id);
    if (!categoria) throw new CategoriaNoEncontradaError();
    categoria.cambiarDisponibilidad(activa);
    await this.categorias.guardar(categoria);
    return categoria;
  }
}

/** Sin actor: solo categorías activas (público). Con incluirInactivas: exige administrador. */
export class ListarCategorias {
  constructor(private readonly categorias: CategoriaRepository) {}
  async ejecutar(opciones: { incluirInactivas?: boolean } = {}, actor?: Actor): Promise<Categoria[]> {
    if (opciones.incluirInactivas) {
      if (!actor) throw new ErrorProhibido('Solo un administrador puede ver categorías inactivas.');
      exigirAdmin(actor);
    }
    return this.categorias.listar({ soloActivas: !opciones.incluirInactivas });
  }
}
