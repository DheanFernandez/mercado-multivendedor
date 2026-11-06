import type { Categoria } from '../../domain/categoria.entity.js';
import type { EstadoPublicacion, Producto } from '../../domain/producto.entity.js';

export interface CategoriaRepository {
  /** @throws CategoriaDuplicadaError (slug único, también ante carreras) */
  guardar(categoria: Categoria): Promise<void>;
  buscarPorId(id: string): Promise<Categoria | null>;
  listar(opciones: { soloActivas: boolean }): Promise<Categoria[]>;
}

export interface FiltroProductos {
  puestoIds?: string[];
  puestoId?: string;
  categoriaId?: string;
  estado?: EstadoPublicacion;
  limite: number;
  desplazamiento: number;
}

export interface ProductoRepository {
  /** Inserta o actualiza el producto y sincroniza sus imágenes en una sola transacción. */
  guardar(producto: Producto): Promise<void>;
  buscarPorId(id: string): Promise<Producto | null>;
  listar(filtro: FiltroProductos): Promise<{ items: Producto[]; total: number }>;
}

export interface PuestoParaProductos {
  id: string;
  codigo: string;
  nombre: string;
  operativo: boolean;
  usuarioIdTitular: string;
}

/** Puerto hacia el módulo Comerciantes y puestos (el adaptador usa su API pública). */
export interface PuestoConsultaPort {
  obtener(puestoId: string): Promise<PuestoParaProductos | null>;
  idsDeTitular(usuarioId: string): Promise<string[]>;
}

export const CATEGORIA_REPOSITORY = Symbol('CATEGORIA_REPOSITORY');
export const PRODUCTO_REPOSITORY = Symbol('PRODUCTO_REPOSITORY');
export const PUESTO_CONSULTA_PORT = Symbol('PUESTO_CONSULTA_PORT');
