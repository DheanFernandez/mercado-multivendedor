import { Module } from '@nestjs/common';
import { MerchantsModule } from '../merchants/merchants.module.js';
import { ProductsModule } from '../products/products.module.js';
import {
  INVENTARIO_REPOSITORY,
  PROPIEDAD_PRODUCTO_PORT,
  type InventarioRepository,
  type PropiedadProductoPort,
} from './application/ports/ports.js';
import {
  ConfirmarVentaReservada,
  ConsultarDisponibilidad,
  ConsultarInventarioProducto,
  ExpirarReservasVencidas,
  LiberarReserva,
  ListarInventario,
  ListarMovimientos,
  RegistrarMovimientoStock,
  ReservarInventario,
} from './application/use-cases/inventario.use-cases.js';
import { InventarioController } from './entry-adapters/inventario.controller.js';
import { PrismaInventarioRepository } from './infrastructure/prisma-inventario.repository.js';
import { PropiedadProductoAdapter } from './infrastructure/propiedad-producto.adapter.js';

type Inv = InventarioRepository;
type Prop = PropiedadProductoPort;

/** Raíz de composición del módulo Inventario. Exporta la API pública que consumirán pedidos, pagos y catálogo. */
@Module({
  imports: [MerchantsModule, ProductsModule],
  controllers: [InventarioController],
  providers: [
    { provide: INVENTARIO_REPOSITORY, useClass: PrismaInventarioRepository },
    { provide: PROPIEDAD_PRODUCTO_PORT, useClass: PropiedadProductoAdapter },
    { provide: RegistrarMovimientoStock, useFactory: (i: Inv, p: Prop) => new RegistrarMovimientoStock(i, p), inject: [INVENTARIO_REPOSITORY, PROPIEDAD_PRODUCTO_PORT] },
    { provide: ConsultarInventarioProducto, useFactory: (i: Inv, p: Prop) => new ConsultarInventarioProducto(i, p), inject: [INVENTARIO_REPOSITORY, PROPIEDAD_PRODUCTO_PORT] },
    { provide: ListarInventario, useFactory: (i: Inv, p: Prop) => new ListarInventario(i, p), inject: [INVENTARIO_REPOSITORY, PROPIEDAD_PRODUCTO_PORT] },
    { provide: ListarMovimientos, useFactory: (i: Inv, p: Prop) => new ListarMovimientos(i, p), inject: [INVENTARIO_REPOSITORY, PROPIEDAD_PRODUCTO_PORT] },
    { provide: ConsultarDisponibilidad, useFactory: (i: Inv) => new ConsultarDisponibilidad(i), inject: [INVENTARIO_REPOSITORY] },
    { provide: ReservarInventario, useFactory: (i: Inv) => new ReservarInventario(i), inject: [INVENTARIO_REPOSITORY] },
    { provide: LiberarReserva, useFactory: (i: Inv) => new LiberarReserva(i), inject: [INVENTARIO_REPOSITORY] },
    { provide: ConfirmarVentaReservada, useFactory: (i: Inv) => new ConfirmarVentaReservada(i), inject: [INVENTARIO_REPOSITORY] },
    { provide: ExpirarReservasVencidas, useFactory: (i: Inv) => new ExpirarReservasVencidas(i), inject: [INVENTARIO_REPOSITORY] },
  ],
  exports: [ReservarInventario, LiberarReserva, ConfirmarVentaReservada, ExpirarReservasVencidas, ConsultarDisponibilidad],
})
export class InventoryModule {}
