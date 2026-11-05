import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type { Actor } from '../../../../shared/domain/actor.js';
import { ActorRequerido } from '../../../../shared/http/actor.js';
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
}
