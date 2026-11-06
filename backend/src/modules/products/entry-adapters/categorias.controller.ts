import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import type { Actor } from '../../../shared/domain/actor.js';
import { ActorRequerido, Public } from '../../../shared/http/actor.js';
import {
  ActualizarCategoria,
  CambiarDisponibilidadCategoria,
  CrearCategoria,
  ListarCategorias,
} from '../application/use-cases/categorias.use-cases.js';
import type { Categoria } from '../domain/categoria.entity.js';

const vista = (c: Categoria) => c.toJSON();

/** Adaptador de entrada. La autorización vive en los casos de uso. */
@Controller('api/v1/categorias')
export class CategoriasController {
  constructor(
    @Inject(CrearCategoria) private readonly crear: CrearCategoria,
    @Inject(ActualizarCategoria) private readonly actualizar: ActualizarCategoria,
    @Inject(CambiarDisponibilidadCategoria) private readonly disponibilidad: CambiarDisponibilidadCategoria,
    @Inject(ListarCategorias) private readonly listar: ListarCategorias,
  ) {}

  /** Público: solo categorías activas. */
  @Public()
  @Get()
  async listarActivas() {
    return (await this.listar.ejecutar()).map(vista);
  }

  /** Administrador: todas, incluidas las inactivas. */
  @Get('gestion')
  async listarTodas(@ActorRequerido() actor: Actor) {
    return (await this.listar.ejecutar({ incluirInactivas: true }, actor)).map(vista);
  }

  @Post()
  async crearCategoria(@Body() cuerpo: { nombre: string; descripcion?: string }, @ActorRequerido() actor: Actor) {
    return vista(await this.crear.ejecutar({ nombre: cuerpo?.nombre, descripcion: cuerpo?.descripcion }, actor));
  }

  @Patch(':id')
  async actualizarCategoria(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() cuerpo: { nombre?: string; descripcion?: string | null },
    @ActorRequerido() actor: Actor,
  ) {
    return vista(await this.actualizar.ejecutar(id, { nombre: cuerpo?.nombre, descripcion: cuerpo?.descripcion }, actor));
  }

  @Patch(':id/estado')
  async cambiarEstado(@Param('id', new ParseUUIDPipe()) id: string, @Body() cuerpo: { activa: boolean }, @ActorRequerido() actor: Actor) {
    return vista(await this.disponibilidad.ejecutar(id, cuerpo?.activa, actor));
  }
}
