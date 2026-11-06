import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Actor } from '../../../shared/domain/actor.js';
import { ALMACEN_ARCHIVOS, type AlmacenArchivos } from '../../../shared/application/ports/almacen-archivos.port.js';
import { ActorRequerido } from '../../../shared/http/actor.js';
import {
  ActualizarProducto,
  type AccionEstado,
  CambiarEstadoProducto,
  CrearProducto,
  EliminarImagenProducto,
  ListarProductosGestion,
  MAX_BYTES_IMAGEN,
  ObtenerProductoGestion,
  SubirImagenProducto,
} from '../application/use-cases/productos.use-cases.js';
import type { EstadoPublicacion, Producto } from '../domain/producto.entity.js';

interface ArchivoSubido {
  buffer: Buffer;
  mimetype: string;
}
const entero = (v?: string) => (v === undefined ? undefined : Number(v));

/** El precio sale como texto con dos decimales ("12.50"); las rutas de imagen se convierten en URL públicas. */
export const vistaProducto = (p: Producto, urlPublica: (ruta: string) => string | null) => ({
  id: p.id,
  puestoId: p.puestoId,
  categoriaId: p.categoriaId,
  nombre: p.nombre,
  descripcion: p.descripcion,
  precio: p.precio.toString(),
  unidadVenta: p.unidadVenta,
  presentacion: p.presentacion,
  estado: p.estado,
  imagenes: p.imagenes.map((i) => ({ id: i.id, url: urlPublica(i.ruta), textoAlternativo: i.textoAlternativo, orden: i.orden })),
  creadoEn: p.creadoEn,
});

/** Gestión de productos del comerciante (el catálogo público está en el módulo `catalog`). */
@Controller('api/v1/productos')
export class ProductosController {
  constructor(
    @Inject(CrearProducto) private readonly crear: CrearProducto,
    @Inject(ActualizarProducto) private readonly actualizar: ActualizarProducto,
    @Inject(CambiarEstadoProducto) private readonly estado: CambiarEstadoProducto,
    @Inject(ListarProductosGestion) private readonly listar: ListarProductosGestion,
    @Inject(ObtenerProductoGestion) private readonly obtener: ObtenerProductoGestion,
    @Inject(SubirImagenProducto) private readonly subirImagen: SubirImagenProducto,
    @Inject(EliminarImagenProducto) private readonly eliminarImagen: EliminarImagenProducto,
    @Inject(ALMACEN_ARCHIVOS) private readonly almacen: AlmacenArchivos,
  ) {}

  private v = (p: Producto) => vistaProducto(p, (r) => this.almacen.urlPublica(r));

  @Post()
  async crearProducto(@Body() c: Record<string, unknown>, @ActorRequerido() actor: Actor) {
    return this.v(
      await this.crear.ejecutar(
        {
          puestoId: c?.['puestoId'] as string,
          categoriaId: c?.['categoriaId'] as string,
          nombre: c?.['nombre'] as string,
          descripcion: c?.['descripcion'] as string | undefined,
          precio: c?.['precio'],
          unidadVenta: c?.['unidadVenta'] as string,
          presentacion: c?.['presentacion'] as string | undefined,
        },
        actor,
      ),
    );
  }

  @Get()
  async listarProductos(
    @ActorRequerido() actor: Actor,
    @Query('puestoId') puestoId?: string,
    @Query('categoriaId') categoriaId?: string,
    @Query('estado') estado?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
  ) {
    const r = await this.listar.ejecutar(actor, { puestoId, categoriaId, estado: estado as EstadoPublicacion | undefined, pagina: entero(pagina), limite: entero(limite) });
    return { ...r, datos: r.datos.map(this.v) };
  }

  @Get(':id')
  async obtenerProducto(@Param('id', new ParseUUIDPipe()) id: string, @ActorRequerido() actor: Actor) {
    return this.v(await this.obtener.ejecutar(id, actor));
  }

  @Patch(':id')
  async actualizarProducto(@Param('id', new ParseUUIDPipe()) id: string, @Body() c: Record<string, unknown>, @ActorRequerido() actor: Actor) {
    // Lista blanca de campos: el puesto y el estado no se cambian por aquí.
    const cambios: Record<string, unknown> = {};
    for (const campo of ['categoriaId', 'nombre', 'descripcion', 'precio', 'unidadVenta', 'presentacion']) {
      if (c && campo in c) cambios[campo] = c[campo];
    }
    return this.v(await this.actualizar.ejecutar(id, cambios, actor));
  }

  @Patch(':id/estado')
  async cambiarEstado(@Param('id', new ParseUUIDPipe()) id: string, @Body() c: { accion: AccionEstado }, @ActorRequerido() actor: Actor) {
    return this.v(await this.estado.ejecutar(id, c?.accion, actor));
  }

  @Post(':id/imagenes')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: MAX_BYTES_IMAGEN, files: 1 } }))
  async subir(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() archivo: ArchivoSubido | undefined,
    @Body() c: { textoAlternativo?: string },
    @ActorRequerido() actor: Actor,
  ) {
    return this.v(await this.subirImagen.ejecutar(id, { contenido: archivo?.buffer as Buffer, tipoMime: archivo?.mimetype as string, textoAlternativo: c?.textoAlternativo }, actor));
  }

  @Delete(':id/imagenes/:imagenId')
  async quitarImagen(@Param('id', new ParseUUIDPipe()) id: string, @Param('imagenId', new ParseUUIDPipe()) imagenId: string, @ActorRequerido() actor: Actor) {
    return this.v(await this.eliminarImagen.ejecutar(id, imagenId, actor));
  }
}
