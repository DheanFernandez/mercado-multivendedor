import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post } from '@nestjs/common';
import type { Actor } from '../../../shared/domain/actor.js';
import { ActorRequerido } from '../../../shared/http/actor.js';
import {
  ActualizarCantidadCarrito,
  AgregarAlCarrito,
  ConsultarCarrito,
  QuitarDelCarrito,
  VaciarCarrito,
} from '../application/use-cases/carrito.use-cases.js';

/** Carrito multivendedor del cliente autenticado (RF20–RF24; HU04–HU06). Cada respuesta devuelve el carrito completo. */
@Controller('api/v1/carrito')
export class CarritoController {
  constructor(
    @Inject(ConsultarCarrito) private readonly consultar: ConsultarCarrito,
    @Inject(AgregarAlCarrito) private readonly agregar: AgregarAlCarrito,
    @Inject(ActualizarCantidadCarrito) private readonly actualizar: ActualizarCantidadCarrito,
    @Inject(QuitarDelCarrito) private readonly quitar: QuitarDelCarrito,
    @Inject(VaciarCarrito) private readonly vaciar: VaciarCarrito,
  ) {}

  @Get()
  obtener(@ActorRequerido() actor: Actor) {
    return this.consultar.ejecutar(actor);
  }

  @Post('items')
  agregarItem(@Body() c: Record<string, unknown>, @ActorRequerido() actor: Actor) {
    return this.agregar.ejecutar(actor, { productoId: c?.['productoId'], cantidad: c?.['cantidad'] });
  }

  @Patch('items/:productoId')
  actualizarItem(@Param('productoId') productoId: string, @Body() c: Record<string, unknown>, @ActorRequerido() actor: Actor) {
    return this.actualizar.ejecutar(actor, productoId, { cantidad: c?.['cantidad'] });
  }

  @Delete('items/:productoId')
  quitarItem(@Param('productoId') productoId: string, @ActorRequerido() actor: Actor) {
    return this.quitar.ejecutar(actor, productoId);
  }

  @Delete()
  @HttpCode(200)
  vaciarCarrito(@ActorRequerido() actor: Actor) {
    return this.vaciar.ejecutar(actor);
  }
}
