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
