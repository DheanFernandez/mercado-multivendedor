import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import type { Actor } from '../../../shared/domain/actor.js';
import { ActorRequerido } from '../../../shared/http/actor.js';
import {
  ConsultarInventarioProducto,
  ListarInventario,
  ListarMovimientos,
  RegistrarMovimientoStock,
} from '../application/use-cases/inventario.use-cases.js';

const entero = (v?: string) => (v === undefined ? undefined : Number(v));

/** Gestión del inventario por el comerciante titular (HU14, HU15). La reserva es API interna, no una ruta HTTP. */
@Controller('api/v1/inventario')
export class InventarioController {
  constructor(
    @Inject(ListarInventario) private readonly listar: ListarInventario,
    @Inject(ConsultarInventarioProducto) private readonly consultar: ConsultarInventarioProducto,
    @Inject(RegistrarMovimientoStock) private readonly registrar: RegistrarMovimientoStock,
    @Inject(ListarMovimientos) private readonly movimientos: ListarMovimientos,
  ) {}

  @Get()
  listarInventario(@ActorRequerido() actor: Actor, @Query('puestoId') puestoId?: string, @Query('pagina') pagina?: string, @Query('limite') limite?: string) {
    return this.listar.ejecutar(actor, { puestoId, pagina: entero(pagina), limite: entero(limite) });
  }

  @Get('productos/:productoId')
  consultarProducto(@Param('productoId') productoId: string, @ActorRequerido() actor: Actor) {
    return this.consultar.ejecutar(productoId, actor);
  }

  @Get('productos/:productoId/movimientos')
  listarMovimientos(@Param('productoId') productoId: string, @ActorRequerido() actor: Actor, @Query('pagina') pagina?: string, @Query('limite') limite?: string) {
    return this.movimientos.ejecutar(productoId, actor, { pagina: entero(pagina), limite: entero(limite) });
  }

  @Post('productos/:productoId/movimientos')
  registrarMovimiento(@Param('productoId') productoId: string, @Body() c: Record<string, unknown>, @ActorRequerido() actor: Actor) {
    return this.registrar.ejecutar(productoId, { tipo: c?.['tipo'], cantidad: c?.['cantidad'], motivo: c?.['motivo'] }, actor);
  }
}
