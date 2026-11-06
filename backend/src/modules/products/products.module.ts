import { Module } from '@nestjs/common';
import { ALMACEN_ARCHIVOS, type AlmacenArchivos } from '../../shared/application/ports/almacen-archivos.port.js';
import { MerchantsModule } from '../merchants/merchants.module.js';
import {
  CATEGORIA_REPOSITORY,
  PRODUCTO_REPOSITORY,
  PUESTO_CONSULTA_PORT,
  type CategoriaRepository,
  type ProductoRepository,
  type PuestoConsultaPort,
} from './application/ports/ports.js';
import {
  ActualizarCategoria,
  CambiarDisponibilidadCategoria,
  CrearCategoria,
  ListarCategorias,
} from './application/use-cases/categorias.use-cases.js';
import {
  ActualizarProducto,
  CambiarEstadoProducto,
  CrearProducto,
  EliminarImagenProducto,
  ListarProductosGestion,
  ObtenerProductoGestion,
  ObtenerPuestoDeProducto,
  SubirImagenProducto,
} from './application/use-cases/productos.use-cases.js';
import { CategoriasController } from './entry-adapters/categorias.controller.js';
import { ProductosController } from './entry-adapters/productos.controller.js';
import { PrismaCategoriaRepository, PrismaProductoRepository } from './infrastructure/prisma-products.repositories.js';
import { PuestoConsultaAdapter } from './infrastructure/puesto-consulta.adapter.js';

type Cat = CategoriaRepository;
type Prod = ProductoRepository;
type Pst = PuestoConsultaPort;

/** Raíz de composición del módulo Productos y categorías. */
@Module({
  imports: [MerchantsModule],
  controllers: [CategoriasController, ProductosController],
  providers: [
    { provide: CATEGORIA_REPOSITORY, useClass: PrismaCategoriaRepository },
    { provide: PRODUCTO_REPOSITORY, useClass: PrismaProductoRepository },
    { provide: PUESTO_CONSULTA_PORT, useClass: PuestoConsultaAdapter },
    { provide: CrearCategoria, useFactory: (c: Cat) => new CrearCategoria(c), inject: [CATEGORIA_REPOSITORY] },
    { provide: ActualizarCategoria, useFactory: (c: Cat) => new ActualizarCategoria(c), inject: [CATEGORIA_REPOSITORY] },
    { provide: CambiarDisponibilidadCategoria, useFactory: (c: Cat) => new CambiarDisponibilidadCategoria(c), inject: [CATEGORIA_REPOSITORY] },
    { provide: ListarCategorias, useFactory: (c: Cat) => new ListarCategorias(c), inject: [CATEGORIA_REPOSITORY] },
    { provide: CrearProducto, useFactory: (p: Prod, c: Cat, s: Pst) => new CrearProducto(p, c, s), inject: [PRODUCTO_REPOSITORY, CATEGORIA_REPOSITORY, PUESTO_CONSULTA_PORT] },
    { provide: ActualizarProducto, useFactory: (p: Prod, c: Cat, s: Pst) => new ActualizarProducto(p, c, s), inject: [PRODUCTO_REPOSITORY, CATEGORIA_REPOSITORY, PUESTO_CONSULTA_PORT] },
    { provide: CambiarEstadoProducto, useFactory: (p: Prod, c: Cat, s: Pst) => new CambiarEstadoProducto(p, c, s), inject: [PRODUCTO_REPOSITORY, CATEGORIA_REPOSITORY, PUESTO_CONSULTA_PORT] },
    { provide: ListarProductosGestion, useFactory: (p: Prod, s: Pst) => new ListarProductosGestion(p, s), inject: [PRODUCTO_REPOSITORY, PUESTO_CONSULTA_PORT] },
    { provide: ObtenerProductoGestion, useFactory: (p: Prod, s: Pst) => new ObtenerProductoGestion(p, s), inject: [PRODUCTO_REPOSITORY, PUESTO_CONSULTA_PORT] },
    { provide: ObtenerPuestoDeProducto, useFactory: (p: Prod) => new ObtenerPuestoDeProducto(p), inject: [PRODUCTO_REPOSITORY] },
    { provide: SubirImagenProducto, useFactory: (p: Prod, s: Pst, a: AlmacenArchivos) => new SubirImagenProducto(p, s, a), inject: [PRODUCTO_REPOSITORY, PUESTO_CONSULTA_PORT, ALMACEN_ARCHIVOS] },
    { provide: EliminarImagenProducto, useFactory: (p: Prod, s: Pst, a: AlmacenArchivos) => new EliminarImagenProducto(p, s, a), inject: [PRODUCTO_REPOSITORY, PUESTO_CONSULTA_PORT, ALMACEN_ARCHIVOS] },
  ],
  exports: [ObtenerPuestoDeProducto],
})
export class ProductsModule {}
