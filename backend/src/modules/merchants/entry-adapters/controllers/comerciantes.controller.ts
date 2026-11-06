import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { Actor } from '../../../../shared/domain/actor.js';
import { ActorRequerido, Public } from '../../../../shared/http/actor.js';
import {
  ActualizarComerciante,
  ActualizarPuesto,
  CambiarEstadoComerciante,
  CambiarEstadoPuesto,
  ListarPuestosPublicos,
  ObtenerPuesto,
} from '../../application/use-cases/gestion-merchants.use-cases.js';
import { ConsultarComerciante, ListarComerciantes, RegistrarComerciante } from '../../application/use-cases/comerciantes.use-cases.js';
import { ListarPuestos, RegistrarPuesto } from '../../application/use-cases/puestos.use-cases.js';

const num = (v?: string) => (v === undefined ? undefined : Number(v));

/** Adaptador de entrada: traduce HTTP ↔ casos de uso. Toda la autorización vive en los casos de uso. */
@Controller('api/v1')
export class ComerciantesController {
  constructor(
    @Inject(RegistrarComerciante) private readonly registrarComerciante: RegistrarComerciante,
    @Inject(ConsultarComerciante) private readonly consultarComerciante: ConsultarComerciante,
    @Inject(ListarComerciantes) private readonly listarComerciantes: ListarComerciantes,
    @Inject(RegistrarPuesto) private readonly registrarPuesto: RegistrarPuesto,
    @Inject(ListarPuestos) private readonly listarPuestos: ListarPuestos,
    @Inject(ActualizarComerciante) private readonly actualizarComerciante: ActualizarComerciante,
    @Inject(CambiarEstadoComerciante) private readonly estadoComerciante: CambiarEstadoComerciante,
    @Inject(ActualizarPuesto) private readonly actualizarPuesto: ActualizarPuesto,
    @Inject(CambiarEstadoPuesto) private readonly estadoPuesto: CambiarEstadoPuesto,
    @Inject(ObtenerPuesto) private readonly obtenerPuesto: ObtenerPuesto,
    @Inject(ListarPuestosPublicos) private readonly puestosPublicos: ListarPuestosPublicos,
  ) {}

  @Post('comerciantes')
  async registrar(@Body() cuerpo: { usuarioId: string; nombreComercial: string }, @ActorRequerido() actor: Actor) {
    return (await this.registrarComerciante.ejecutar({ usuarioId: cuerpo?.usuarioId, nombreComercial: cuerpo?.nombreComercial }, actor)).toJSON();
  }

  @Get('comerciantes')
  async listar(@ActorRequerido() actor: Actor, @Query('limite') limite?: string, @Query('desplazamiento') desplazamiento?: string) {
    return (await this.listarComerciantes.ejecutar(actor, { limite: num(limite), desplazamiento: num(desplazamiento) })).map((c) => c.toJSON());
  }

  @Get('comerciantes/:id')
  async consultar(@Param('id', new ParseUUIDPipe()) id: string, @ActorRequerido() actor: Actor) {
    return (await this.consultarComerciante.ejecutar(id, actor)).toJSON();
  }

  @Post('puestos')
  async registrarUnPuesto(@Body() cuerpo: { comercianteId: string; codigo: string; nombre: string }, @ActorRequerido() actor: Actor) {
    return (await this.registrarPuesto.ejecutar({ comercianteId: cuerpo?.comercianteId, codigo: cuerpo?.codigo, nombre: cuerpo?.nombre }, actor)).toJSON();
  }

  @Get('puestos')
  async listarLosPuestos(
    @ActorRequerido() actor: Actor,
    @Query('comercianteId') comercianteId?: string,
    @Query('limite') limite?: string,
    @Query('desplazamiento') desplazamiento?: string,
  ) {
    return (await this.listarPuestos.ejecutar(actor, { comercianteId, limite: num(limite), desplazamiento: num(desplazamiento) })).map((p) => p.toJSON());
  }

  @Patch('comerciantes/:id')
  async editarComerciante(@Param('id', new ParseUUIDPipe()) id: string, @Body() cuerpo: { nombreComercial?: string }, @ActorRequerido() actor: Actor) {
    return (await this.actualizarComerciante.ejecutar(id, { nombreComercial: cuerpo?.nombreComercial }, actor)).toJSON();
  }

  @Patch('comerciantes/:id/estado')
  async estadoDelComerciante(@Param('id', new ParseUUIDPipe()) id: string, @Body() cuerpo: { activo: boolean }, @ActorRequerido() actor: Actor) {
    return (await this.estadoComerciante.ejecutar(id, cuerpo?.activo, actor)).toJSON();
  }

  /** Público: puestos operativos, para filtrar el catálogo por puesto (RF18). Debe ir antes de `puestos/:id`. */
  @Public()
  @Get('puestos/publicos')
  async publicos(@Query('limite') limite?: string, @Query('desplazamiento') desplazamiento?: string) {
    return (await this.puestosPublicos.ejecutar({ limite: num(limite), desplazamiento: num(desplazamiento) })).map((p) => ({
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
    }));
  }

  @Get('puestos/:id')
  async consultarPuesto(@Param('id', new ParseUUIDPipe()) id: string, @ActorRequerido() actor: Actor) {
    return (await this.obtenerPuesto.ejecutar(id, actor)).toJSON();
  }

  @Patch('puestos/:id')
  async editarPuesto(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() cuerpo: { codigo?: string; nombre?: string; comercianteId?: string },
    @ActorRequerido() actor: Actor,
  ) {
    return (await this.actualizarPuesto.ejecutar(id, { codigo: cuerpo?.codigo, nombre: cuerpo?.nombre, comercianteId: cuerpo?.comercianteId }, actor)).toJSON();
  }

  @Patch('puestos/:id/estado')
  async estadoDelPuesto(@Param('id', new ParseUUIDPipe()) id: string, @Body() cuerpo: { activo: boolean }, @ActorRequerido() actor: Actor) {
    return (await this.estadoPuesto.ejecutar(id, cuerpo?.activo, actor)).toJSON();
  }
}
