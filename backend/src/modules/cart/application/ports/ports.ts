export interface ItemGuardado {
  productoId: string;
  puestoId: string;
  cantidad: number;
}

export type ResultadoAgregar = { resultado: 'AGREGADO'; cantidad: number } | { resultado: 'SUPERA_TOPE' } | { resultado: 'LIMITE_ITEMS' };

/** Persistencia del carrito. Cada método es UNA transacción corta; las sumas y topes se resuelven en la base. */
export interface CarritoRepository {
  /** Ítems del carrito del usuario, del más antiguo al más reciente. */
  listar(usuarioId: string): Promise<ItemGuardado[]>;
  /**
   * Suma `cantidad` al producto (lo crea si falta; crea el carrito si falta) de forma atómica: nunca deja la cantidad
   * resultante por encima de `tope` ni más de `maxItems` productos distintos, aunque haya solicitudes simultáneas.
   */
  agregar(c: { usuarioId: string; productoId: string; puestoId: string; cantidad: number; tope: number; maxItems: number }): Promise<ResultadoAgregar>;
  /** Fija la cantidad de un ítem existente. false si el ítem no existe. */
  fijarCantidad(c: { usuarioId: string; productoId: string; cantidad: number }): Promise<boolean>;
  /** false si el ítem no existía. */
  quitar(c: { usuarioId: string; productoId: string }): Promise<boolean>;
  vaciar(usuarioId: string): Promise<void>;
}

export interface ProductoVendible {
  productoId: string;
  nombre: string;
  unidadVenta: string;
  presentacion: string | null;
  precioCentimos: number;
  puesto: { id: string; codigo: string; nombre: string };
}

/** Puerto hacia Catálogo/Productos (el adaptador usa la API pública): producto comprable hoy, o null. */
export interface ProductoVendiblePort {
  obtener(productoId: string): Promise<ProductoVendible | null>;
}

/** Puerto hacia Inventario (el adaptador usa su API pública): unidades disponibles (físico − reservado). */
export interface DisponibilidadPort {
  disponible(productoId: string): Promise<number>;
}

export const CARRITO_REPOSITORY = Symbol('CARRITO_REPOSITORY');
export const PRODUCTO_VENDIBLE_PORT = Symbol('PRODUCTO_VENDIBLE_PORT');
export const DISPONIBILIDAD_PORT = Symbol('DISPONIBILIDAD_PORT');
