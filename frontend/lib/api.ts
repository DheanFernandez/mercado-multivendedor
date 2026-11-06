"use client";

import { supabase } from "@/lib/supabase";
import type { Categoria, Comerciante, Pagina, Perfil, Producto, ProductoCatalogo, Puesto, Rol } from "@/lib/tipos";

export type { Perfil } from "@/lib/tipos";

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

const base = () => (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");

async function peticion<T>(ruta: string, init: RequestInit = {}, conSesion = false): Promise<T> {
  const cabeceras = new Headers(init.headers);
  // En multipart (FormData) el navegador fija el Content-Type con su boundary.
  if (!(init.body instanceof FormData)) cabeceras.set("Content-Type", "application/json");
  if (conSesion) {
    const { data } = await supabase().auth.getSession();
    if (data.session) cabeceras.set("Authorization", `Bearer ${data.session.access_token}`);
  }
  let res: Response;
  try {
    res = await fetch(`${base()}${ruta}`, { ...init, headers: cabeceras });
  } catch {
    throw new ErrorApi(0, "No se pudo conectar con el servidor.");
  }
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) throw new ErrorApi(res.status, typeof cuerpo?.mensaje === "string" ? cuerpo.mensaje : "Error inesperado.");
  return cuerpo as T;
}

const consulta = (params: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
};
const json = (metodo: string, cuerpo: unknown): RequestInit => ({ method: metodo, body: JSON.stringify(cuerpo) });

// ───── Autenticación ─────

/** Autorregistro: el rol lo fija el servidor (siempre CLIENTE); aquí no se envía. */
export const registrarCliente = (datos: { email: string; contrasena: string; nombres: string; apellidos: string; telefono?: string }) =>
  peticion<Perfil>("/api/v1/auth/registro", json("POST", datos));

/** Perfil y rol del usuario, leídos por el servidor desde PostgreSQL. Solo para mostrar; no es una barrera de seguridad. */
export const obtenerPerfil = () => peticion<Perfil>("/api/v1/auth/me", {}, true);

// ───── Catálogo público ─────

export const listarCategorias = () => peticion<Categoria[]>("/api/v1/categorias");

export interface FiltroCatalogo {
  q?: string;
  categoriaId?: string;
  puestoId?: string;
  precioMin?: string;
  precioMax?: string;
  orden?: string;
  pagina?: number;
  limite?: number;
}
export const buscarCatalogo = (f: FiltroCatalogo) => peticion<Pagina<ProductoCatalogo>>(`/api/v1/catalogo/productos${consulta({ ...f })}`);
export const detalleCatalogo = (id: string) => peticion<ProductoCatalogo>(`/api/v1/catalogo/productos/${encodeURIComponent(id)}`);

// ───── Gestión (requiere sesión; la autorización real la aplica el backend) ─────

export const misPuestos = () => peticion<Puesto[]>("/api/v1/puestos", {}, true);

export const listarProductos = (f: { estado?: string; pagina?: number; limite?: number }) =>
  peticion<Pagina<Producto>>(`/api/v1/productos${consulta({ ...f })}`, {}, true);
export const obtenerProducto = (id: string) => peticion<Producto>(`/api/v1/productos/${encodeURIComponent(id)}`, {}, true);

export interface DatosProducto {
  puestoId?: string;
  categoriaId: string;
  nombre: string;
  descripcion?: string;
  precio: string;
  unidadVenta: string;
  presentacion?: string;
}
export const crearProducto = (d: DatosProducto) => peticion<Producto>("/api/v1/productos", json("POST", d), true);
export const actualizarProducto = (id: string, d: Partial<Omit<DatosProducto, "puestoId">>) =>
  peticion<Producto>(`/api/v1/productos/${encodeURIComponent(id)}`, json("PATCH", d), true);
export const cambiarEstadoProducto = (id: string, accion: "PUBLICAR" | "DESACTIVAR") =>
  peticion<Producto>(`/api/v1/productos/${encodeURIComponent(id)}/estado`, json("PATCH", { accion }), true);
export const subirImagen = (id: string, archivo: File, textoAlternativo?: string) => {
  const f = new FormData();
  f.append("archivo", archivo);
  if (textoAlternativo) f.append("textoAlternativo", textoAlternativo);
  return peticion<Producto>(`/api/v1/productos/${encodeURIComponent(id)}/imagenes`, { method: "POST", body: f }, true);
};
export const eliminarImagen = (id: string, imagenId: string) =>
  peticion<Producto>(`/api/v1/productos/${encodeURIComponent(id)}/imagenes/${encodeURIComponent(imagenId)}`, { method: "DELETE" }, true);

// ───── Categorías (administrador) ─────

export const listarCategoriasGestion = () => peticion<Categoria[]>("/api/v1/categorias/gestion", {}, true);
export const crearCategoria = (d: { nombre: string; descripcion?: string }) => peticion<Categoria>("/api/v1/categorias", json("POST", d), true);
export const actualizarCategoria = (id: string, d: { nombre?: string; descripcion?: string | null }) =>
  peticion<Categoria>(`/api/v1/categorias/${encodeURIComponent(id)}`, json("PATCH", d), true);
export const cambiarDisponibilidadCategoria = (id: string, activa: boolean) =>
  peticion<Categoria>(`/api/v1/categorias/${encodeURIComponent(id)}/estado`, json("PATCH", { activa }), true);

// ───── Administración (solo administrador; el backend lo verifica en cada operación) ─────

export const listarUsuarios = (f: { limite?: number; desplazamiento?: number } = {}) => peticion<Perfil[]>(`/api/v1/usuarios${consulta({ ...f })}`, {}, true);
/** Alta por el administrador: el backend envía la invitación por correo. El rol lo valida el servidor. */
export const invitarUsuario = (d: { email: string; nombres: string; apellidos: string; telefono?: string; rol: Rol }) =>
  peticion<Perfil>("/api/v1/usuarios", json("POST", d), true);

export const listarComerciantes = (f: { limite?: number; desplazamiento?: number } = {}) =>
  peticion<Comerciante[]>(`/api/v1/comerciantes${consulta({ ...f })}`, {}, true);
export const registrarComerciante = (d: { usuarioId: string; nombreComercial: string }) =>
  peticion<Comerciante>("/api/v1/comerciantes", json("POST", d), true);

export const listarPuestos = (f: { comercianteId?: string; limite?: number; desplazamiento?: number } = {}) =>
  peticion<Puesto[]>(`/api/v1/puestos${consulta({ ...f })}`, {}, true);
export const registrarPuesto = (d: { comercianteId: string; codigo: string; nombre: string }) => peticion<Puesto>("/api/v1/puestos", json("POST", d), true);

// ───── H0: gestión de usuarios, comerciantes y puestos (solo administrador) ─────

export const cambiarRolUsuario = (id: string, rol: Rol) => peticion<Perfil>(`/api/v1/usuarios/${encodeURIComponent(id)}/rol`, json("PATCH", { rol }), true);
export const cambiarEstadoUsuario = (id: string, activo: boolean) =>
  peticion<Perfil>(`/api/v1/usuarios/${encodeURIComponent(id)}/estado`, json("PATCH", { activo }), true);

export const actualizarComerciante = (id: string, d: { nombreComercial: string }) =>
  peticion<Comerciante>(`/api/v1/comerciantes/${encodeURIComponent(id)}`, json("PATCH", d), true);
export const cambiarEstadoComerciante = (id: string, activo: boolean) =>
  peticion<Comerciante>(`/api/v1/comerciantes/${encodeURIComponent(id)}/estado`, json("PATCH", { activo }), true);

export const actualizarPuesto = (id: string, d: { codigo?: string; nombre?: string; comercianteId?: string }) =>
  peticion<Puesto>(`/api/v1/puestos/${encodeURIComponent(id)}`, json("PATCH", d), true);
export const cambiarEstadoPuesto = (id: string, activo: boolean) =>
  peticion<Puesto>(`/api/v1/puestos/${encodeURIComponent(id)}/estado`, json("PATCH", { activo }), true);

/** Público: puestos operativos, para filtrar el catálogo (RF18). */
export const puestosPublicos = () => peticion<{ id: string; codigo: string; nombre: string }[]>("/api/v1/puestos/publicos");
