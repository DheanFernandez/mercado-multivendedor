export type Rol = "CLIENTE" | "COMERCIANTE" | "TRABAJADOR_PUESTO" | "ADMINISTRADOR";

export interface Perfil {
  id: string;
  email: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  rol: Rol;
  estado: string;
  creadoEn?: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  activa: boolean;
}

export interface Comerciante {
  id: string;
  usuarioId: string;
  nombreComercial: string;
  estado: string;
  creadoEn: string;
}

export interface Puesto {
  id: string;
  comercianteId: string;
  codigo: string;
  nombre: string;
  estado: string;
  creadoEn?: string;
}

export interface Pagina<T> {
  datos: T[];
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
}

export type EstadoPublicacion = "BORRADOR" | "PUBLICADO" | "DESACTIVADO";

/** Producto del catálogo público (solo publicados). El precio es texto con 2 decimales: no se opera con floats. */
export interface ProductoCatalogo {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: string;
  unidadVenta: string;
  presentacion: string | null;
  categoria: { id: string; nombre: string; slug: string };
  puesto: { id: string; codigo: string; nombre: string };
  imagenes: { url: string | null; textoAlternativo: string | null; orden: number }[];
}

/** Producto en el panel del comerciante. */
export interface Producto {
  id: string;
  puestoId: string;
  categoriaId: string;
  nombre: string;
  descripcion: string | null;
  precio: string;
  unidadVenta: string;
  presentacion: string | null;
  estado: EstadoPublicacion;
  imagenes: { id: string; url: string | null; textoAlternativo: string | null; orden: number }[];
  creadoEn: string;
}

// ───── Carrito multivendedor (contrato: specs/002-carrito/contracts/api-carrito.md) ─────

export type EstadoLinea = "OK" | "NO_DISPONIBLE" | "STOCK_INSUFICIENTE";

/** Línea del carrito. Los importes son texto exacto de la API ("12.50"): la interfaz nunca los suma ni multiplica. */
export interface LineaCarrito {
  productoId: string;
  nombre: string | null;
  unidadVenta: string | null;
  presentacion: string | null;
  cantidad: number;
  precioUnitario: string | null;
  subtotal: string | null;
  estado: EstadoLinea;
  /** Unidades disponibles hoy. */
  disponible: number;
}

export interface GrupoPuesto {
  puesto: { id: string; codigo: string | null; nombre: string | null };
  items: LineaCarrito[];
  subtotal: string;
}

export interface Carrito {
  puestos: GrupoPuesto[];
  total: string;
  totalProductos: number;
  /** true si alguna línea no se puede comprar tal cual (producto no disponible o cantidad sobre el stock). */
  requiereRevision: boolean;
}
