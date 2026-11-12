/** Modelo de lectura del catálogo: solo productos PUBLICADOS de puestos y categorías activos. */
export interface ProductoCatalogo {
  id: string;
  nombre: string;
  descripcion: string | null;
  /** Importe en soles con dos decimales, p. ej. "12.50". */
  precio: string;
  unidadVenta: string;
  presentacion: string | null;
  categoria: { id: string; nombre: string; slug: string };
  puesto: { id: string; codigo: string; nombre: string };
  imagenes: { ruta: string; textoAlternativo: string | null; orden: number }[];
}

export type OrdenCatalogo = 'recientes' | 'precio_asc' | 'precio_desc' | 'nombre';

export interface FiltroCatalogo {
  texto?: string;
  categoriaId?: string;
  puestoId?: string;
  /** Céntimos. */
  precioMinCentimos?: number;
  precioMaxCentimos?: number;
  orden: OrdenCatalogo;
  limite: number;
  desplazamiento: number;
}

export interface CatalogoRepository {
  buscar(filtro: FiltroCatalogo): Promise<{ items: ProductoCatalogo[]; total: number }>;
  detalle(id: string): Promise<ProductoCatalogo | null>;
}

/**
 * Lectura en lote por identificadores. Es un puerto APARTE de `CatalogoRepository` (segregación de interfaces): lo usa
 * Carrito para convertir el carrito en pedido y así no cambia la interfaz que ya implementan las pruebas existentes.
 */
export interface CatalogoDetallesRepository {
  /** Los productos que el catálogo expone entre `ids` (publicados, con categoría, puesto y comerciante activos); omite el resto. */
  detalles(ids: string[]): Promise<ProductoCatalogo[]>;
}

export const CATALOGO_REPOSITORY = Symbol('CATALOGO_REPOSITORY');
export const CATALOGO_DETALLES_REPOSITORY = Symbol('CATALOGO_DETALLES_REPOSITORY');
