import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import {
  CARRITO_REPOSITORY,
  DISPONIBILIDAD_PORT,
  PRODUCTO_VENDIBLE_PORT,
  PRODUCTOS_VENDIBLES_LOTE_PORT,
  type CarritoRepository,
  type DisponibilidadPort,
  type ProductoVendiblePort,
  type ProductosVendiblesLotePort,
} from './application/ports/ports.js';
import {
  ActualizarCantidadCarrito,
  AgregarAlCarrito,
  ConsultarCarrito,
  QuitarDelCarrito,
  VaciarCarrito,
  type DependenciasCarrito,
} from './application/use-cases/carrito.use-cases.js';
import { ObtenerCarritoParaPedido, VaciarCarritoDelPedido } from './application/use-cases/pedido.use-cases.js';
import { CarritoController } from './entry-adapters/carrito.controller.js';
import { DisponibilidadAdapter, ProductosVendiblesLoteAdapter, ProductoVendibleAdapter } from './infrastructure/adaptadores.js';
import { PrismaCarritoRepository } from './infrastructure/prisma-carrito.repository.js';

const deps = (carrito: CarritoRepository, productos: ProductoVendiblePort, inventario: DisponibilidadPort): DependenciasCarrito => ({ carrito, productos, inventario });
const INYECTAR = [CARRITO_REPOSITORY, PRODUCTO_VENDIBLE_PORT, DISPONIBILIDAD_PORT];

/** Raíz de composición del módulo Carrito multivendedor. Usa Catálogo e Inventario solo por su API pública. */
@Module({
  imports: [CatalogModule, InventoryModule],
  controllers: [CarritoController],
  exports: [ObtenerCarritoParaPedido, VaciarCarritoDelPedido],
  providers: [
    { provide: CARRITO_REPOSITORY, useClass: PrismaCarritoRepository },
    { provide: PRODUCTO_VENDIBLE_PORT, useClass: ProductoVendibleAdapter },
    { provide: DISPONIBILIDAD_PORT, useClass: DisponibilidadAdapter },
    { provide: PRODUCTOS_VENDIBLES_LOTE_PORT, useClass: ProductosVendiblesLoteAdapter },
    { provide: ObtenerCarritoParaPedido, useFactory: (c: CarritoRepository, l: ProductosVendiblesLotePort) => new ObtenerCarritoParaPedido(c, l), inject: [CARRITO_REPOSITORY, PRODUCTOS_VENDIBLES_LOTE_PORT] },
    { provide: VaciarCarritoDelPedido, useFactory: (c: CarritoRepository) => new VaciarCarritoDelPedido(c), inject: [CARRITO_REPOSITORY] },
    { provide: ConsultarCarrito, useFactory: (c: CarritoRepository, p: ProductoVendiblePort, i: DisponibilidadPort) => new ConsultarCarrito(deps(c, p, i)), inject: INYECTAR },
    {
      provide: AgregarAlCarrito,
      useFactory: (c: CarritoRepository, p: ProductoVendiblePort, i: DisponibilidadPort, q: ConsultarCarrito) => new AgregarAlCarrito(deps(c, p, i), q),
      inject: [...INYECTAR, ConsultarCarrito],
    },
    {
      provide: ActualizarCantidadCarrito,
      useFactory: (c: CarritoRepository, p: ProductoVendiblePort, i: DisponibilidadPort, q: ConsultarCarrito) => new ActualizarCantidadCarrito(deps(c, p, i), q),
      inject: [...INYECTAR, ConsultarCarrito],
    },
    {
      provide: QuitarDelCarrito,
      useFactory: (c: CarritoRepository, p: ProductoVendiblePort, i: DisponibilidadPort, q: ConsultarCarrito) => new QuitarDelCarrito(deps(c, p, i), q),
      inject: [...INYECTAR, ConsultarCarrito],
    },
    { provide: VaciarCarrito, useFactory: (c: CarritoRepository, p: ProductoVendiblePort, i: DisponibilidadPort) => new VaciarCarrito(deps(c, p, i)), inject: INYECTAR },
  ],
})
export class CartModule {}
