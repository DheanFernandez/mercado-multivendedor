import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ALMACEN_ARCHIVOS, type AlmacenArchivos } from '../../../shared/application/ports/almacen-archivos.port.js';
import { Public } from '../../../shared/http/actor.js';
import { ConsultarCatalogo, ObtenerDetalleCatalogo } from '../application/use-cases/catalogo.use-cases.js';
import type { ProductoCatalogo } from '../application/ports/catalogo.repository.js';

const entero = (v?: string) => (v === undefined ? undefined : Number(v));

/** Catálogo público (RF16–RF19): no requiere sesión y solo expone productos publicados. */
@Public()
@Controller('api/v1/catalogo/productos')
export class CatalogoController {
  constructor(
    @Inject(ConsultarCatalogo) private readonly consultar: ConsultarCatalogo,
    @Inject(ObtenerDetalleCatalogo) private readonly detalle: ObtenerDetalleCatalogo,
    @Inject(ALMACEN_ARCHIVOS) private readonly almacen: AlmacenArchivos,
  ) {}

  private vista = (p: ProductoCatalogo) => ({
    ...p,
    imagenes: p.imagenes.map((i) => ({ url: this.almacen.urlPublica(i.ruta), textoAlternativo: i.textoAlternativo, orden: i.orden })),
  });

  @Get()
  async buscar(
    @Query('q') q?: string,
    @Query('categoriaId') categoriaId?: string,
    @Query('puestoId') puestoId?: string,
    @Query('precioMin') precioMin?: string,
    @Query('precioMax') precioMax?: string,
    @Query('orden') orden?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
  ) {
    const r = await this.consultar.ejecutar({ q, categoriaId, puestoId, precioMin, precioMax, orden, pagina: entero(pagina), limite: entero(limite) });
    return { ...r, datos: r.datos.map(this.vista) };
  }

  @Get(':id')
  async obtener(@Param('id') id: string) {
    return this.vista(await this.detalle.ejecutar(id));
  }
}
