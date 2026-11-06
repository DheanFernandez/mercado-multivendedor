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

export const CATALOGO_REPOSITORY = Symbol('CATALOGO_REPOSITORY');
