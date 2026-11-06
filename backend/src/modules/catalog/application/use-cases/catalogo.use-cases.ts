import { ErrorDeValidacion, ErrorNoEncontrado } from '../../../../shared/domain/errors.js';
import { Precio } from '../../../../shared/domain/precio.js';
import { esUuid, paginar, type Pagina } from '../../../../shared/application/paginacion.js';
import type { CatalogoRepository, OrdenCatalogo, ProductoCatalogo } from '../ports/catalogo.repository.js';

const ORDENES: OrdenCatalogo[] = ['recientes', 'precio_asc', 'precio_desc', 'nombre'];

export interface ConsultaCatalogo {
  q?: string;
  categoriaId?: string;
  puestoId?: string;
  precioMin?: unknown;
  precioMax?: unknown;
  orden?: string;
  pagina?: number;
  limite?: number;
}

/** RF16–RF18, HU01–HU02. Consulta pública y paginada de productos publicados. */
export class ConsultarCatalogo {
  constructor(private readonly catalogo: CatalogoRepository) {}

  async ejecutar(c: ConsultaCatalogo = {}): Promise<Pagina<ProductoCatalogo>> {
    const { pagina, limite, desplazamiento } = paginar(c.pagina, c.limite, 50);
    const texto = typeof c.q === 'string' ? c.q.trim() : undefined;
    if (c.q !== undefined && typeof c.q !== 'string') throw new ErrorDeValidacion('El texto de búsqueda no es válido.');
    if (texto && texto.length > 100) throw new ErrorDeValidacion('El texto de búsqueda no puede superar 100 caracteres.');
    if (c.categoriaId !== undefined && !esUuid(c.categoriaId)) throw new ErrorDeValidacion('La categoría no es válida.');
    if (c.puestoId !== undefined && !esUuid(c.puestoId)) throw new ErrorDeValidacion('El puesto no es válido.');
    const orden = (c.orden ?? 'recientes') as OrdenCatalogo;
    if (!ORDENES.includes(orden)) throw new ErrorDeValidacion(`El orden debe ser uno de: ${ORDENES.join(', ')}.`);

    const min = c.precioMin === undefined || c.precioMin === '' ? undefined : Precio.desde(c.precioMin).centimos;
    const max = c.precioMax === undefined || c.precioMax === '' ? undefined : Precio.desde(c.precioMax).centimos;
    if (min !== undefined && max !== undefined && min > max) throw new ErrorDeValidacion('El precio mínimo no puede superar al máximo.');

    const { items, total } = await this.catalogo.buscar({
      texto: texto || undefined,
      categoriaId: c.categoriaId,
      puestoId: c.puestoId,
      precioMinCentimos: min,
      precioMaxCentimos: max,
      orden,
      limite,
      desplazamiento,
    });
    return { datos: items, pagina, limite, total, totalPaginas: Math.ceil(total / limite) };
  }
}

export class CatalogoProductoNoEncontradoError extends ErrorNoEncontrado {
  constructor() {
    super('Producto no encontrado.');
  }
}

/** RF19, HU03. Un producto no publicado (o de un puesto/categoría inactivos) se trata como inexistente. */
export class ObtenerDetalleCatalogo {
  constructor(private readonly catalogo: CatalogoRepository) {}

  async ejecutar(id: string): Promise<ProductoCatalogo> {
    if (!esUuid(id)) throw new CatalogoProductoNoEncontradoError();
    const producto = await this.catalogo.detalle(id);
    if (!producto) throw new CatalogoProductoNoEncontradoError();
    return producto;
  }
}
