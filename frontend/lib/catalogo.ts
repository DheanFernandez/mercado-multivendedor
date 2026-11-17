import { useEffect, useState } from "react";
import { ErrorApi, buscarCatalogo, urlApi } from "@/lib/api";
import type { Pagina, ProductoCatalogo } from "@/lib/tipos";

/**
 * Catálogo público (spec 004-catalogo-publico, enmienda E1). Funciones puras para leer y escribir los filtros en la URL,
 * describirlos y clasificar los errores, y el hook que consulta la API. Los importes nunca se calculan ni se comparan aquí.
 * El rango de precios ya no forma parte de la interfaz (CA-CAT-19): `precioMin` y `precioMax` se ignoran.
 */

/** 24 = múltiplo de 2, 3 y 4 columnas; la API admite hasta 50. */
export const LIMITE_CATALOGO = 24;

/** Órdenes del contrato `GET /api/v1/catalogo/productos` (no existe un orden por relevancia: E1-A2). */
export const ORDENES = [
  { valor: "recientes", texto: "Más recientes" },
  { valor: "nombre", texto: "Nombre (A–Z)" },
  { valor: "precio_asc", texto: "Precio: menor a mayor" },
  { valor: "precio_desc", texto: "Precio: mayor a menor" },
] as const;
export type Orden = (typeof ORDENES)[number]["valor"];

export interface FiltrosCatalogo {
  q?: string;
  categoriaId?: string;
  puestoId?: string;
  orden: Orden;
  pagina: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PAGINA = 10_000;

/** Lee los filtros de la URL. Lo que no es válido, o ya no se ofrece (precio), se ignora y no se envía a la API. */
export function leerFiltros(p: { get(clave: string): string | null }): FiltrosCatalogo {
  const texto = (k: string) => p.get(k)?.trim() || undefined;
  const id = (k: string) => {
    const v = texto(k);
    return v && UUID.test(v) ? v : undefined;
  };
  const o = texto("orden");
  const orden: Orden = ORDENES.some((x) => x.valor === o) ? (o as Orden) : "recientes";
  const n = Number(texto("pagina"));
  const pagina = Number.isInteger(n) && n >= 1 && n <= MAX_PAGINA ? n : 1;
  return { q: texto("q")?.slice(0, 100), categoriaId: id("categoriaId"), puestoId: id("puestoId"), orden, pagina };
}

/** Cadena de consulta sin los valores por defecto (orden «recientes», página 1). */
export function escribirFiltros(f: FiltrosCatalogo): string {
  const s = new URLSearchParams();
  if (f.q) s.set("q", f.q);
  if (f.categoriaId) s.set("categoriaId", f.categoriaId);
  if (f.puestoId) s.set("puestoId", f.puestoId);
  if (f.orden !== "recientes") s.set("orden", f.orden);
  if (f.pagina > 1) s.set("pagina", String(f.pagina));
  return s.toString();
}

/** Aplica cambios a los filtros; cualquier cambio que no sea de página vuelve a la página 1. */
export function cambiarFiltros(f: FiltrosCatalogo, cambios: Partial<FiltrosCatalogo>): FiltrosCatalogo {
  const soloPagina = Object.keys(cambios).every((k) => k === "pagina");
  return { ...f, ...cambios, pagina: soloPagina ? (cambios.pagina ?? f.pagina) : 1 };
}

export const FILTROS_VACIOS: FiltrosCatalogo = { orden: "recientes", pagina: 1 };

/** Filtros que restringen el resultado (el orden y la página no cuentan). */
export const hayFiltros = (f: FiltrosCatalogo) => Boolean(f.q || f.categoriaId || f.puestoId);

export interface EtiquetaFiltro {
  clave: string;
  texto: string;
  quitar: Partial<FiltrosCatalogo>;
}

/** Etiquetas de los filtros activos, cada una con el cambio que la quita (CA-CAT-19). */
export function etiquetasFiltros(
  f: FiltrosCatalogo,
  categorias: { id: string; nombre: string }[] = [],
  puestos: { id: string; codigo: string; nombre: string }[] = [],
): EtiquetaFiltro[] {
  const e: EtiquetaFiltro[] = [];
  if (f.q) e.push({ clave: "q", texto: `«${f.q}»`, quitar: { q: undefined } });
  if (f.categoriaId) e.push({ clave: "categoria", texto: categorias.find((c) => c.id === f.categoriaId)?.nombre ?? "Categoría", quitar: { categoriaId: undefined } });
  if (f.puestoId) {
    const p = puestos.find((x) => x.id === f.puestoId);
    e.push({ clave: "puesto", texto: p ? `Puesto ${p.codigo}` : "Puesto", quitar: { puestoId: undefined } });
  }
  return e;
}

// ───── Iconos de categoría (E1-A4) ─────

export type ClaveCategoria =
  | "frutas"
  | "verduras"
  | "hortalizas"
  | "tuberculos"
  | "abarrotes"
  | "lacteos"
  | "carnes"
  | "pescados"
  | "panaderia"
  | "huevos"
  | "granos"
  | "otra";

/**
 * Palabras que identifican cada tipo de categoría en su `slug` o nombre, ya sin tildes y con espacios en vez de guiones.
 * Gana la primera coincidencia: «frutos del mar» va antes que «frutas».
 */
const PALABRAS: [ClaveCategoria, RegExp][] = [
  ["pescados", /pescad|marisc|frutos del mar/],
  ["frutas", /frut/],
  ["hortalizas", /hortaliz/],
  ["verduras", /verdur|legumbre/],
  ["tuberculos", /tubercul|raices|\bpapas?\b/],
  ["lacteos", /lacte|leche|queso/],
  ["carnes", /carne|pollo|\baves\b|cerdo|embutid/],
  ["panaderia", /panad|pasteler|\bpan(es)?\b/],
  ["huevos", /huevo/],
  ["granos", /grano|menestr|cereal/],
  ["abarrotes", /abarrot|despensa|enlatad/],
];

const sinTildes = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[-_]+/g, " ");

/**
 * Elige el icono decorativo de una categoría registrada a partir de su `slug` o, si no coincide, de su nombre. No añade
 * datos: una categoría desconocida usa el icono genérico.
 */
export function claveCategoria(slug: string, nombre = ""): ClaveCategoria {
  for (const texto of [sinTildes(slug), sinTildes(nombre)]) {
    const hallada = PALABRAS.find(([, re]) => re.test(texto));
    if (hallada) return hallada[0];
  }
  return "otra";
}

// ───── Errores (CA-CAT-08) ─────

export type TipoErrorCatalogo = "conexion" | "no-api" | "servidor" | "validacion" | "otro";

export interface ErrorCatalogo {
  tipo: TipoErrorCatalogo;
  titulo: string;
  mensaje: string;
  /** Solo en desarrollo: cómo resolver un problema de configuración local. */
  pista?: string;
}

export function clasificarError(e: unknown, desarrollo = false): ErrorCatalogo {
  const api = urlApi();
  if (e instanceof ErrorApi) {
    if (e.codigo === "SIN_CONEXION" || e.estado === 0) {
      return {
        tipo: "conexion",
        titulo: "No pudimos conectar con el mercado",
        mensaje: "Revise su conexión a internet e inténtelo de nuevo.",
        pista: desarrollo ? `La API (${api}) no respondió. Compruebe que el backend esté en marcha (npm run start:dev) y que FRONTEND_URL permita este origen.` : undefined,
      };
    }
    if (e.codigo === "RESPUESTA_NO_API") {
      return {
        tipo: "no-api",
        titulo: "El catálogo no está disponible en este momento",
        mensaje: "El servicio del mercado no respondió correctamente. Inténtelo de nuevo en unos minutos.",
        pista: desarrollo
          ? `${api} devolvió una página web en lugar de la API. Suele ocurrir cuando el frontend ocupa el puerto del backend: inicie el backend en ese puerto y el frontend con «npm run dev» (puerto 3001), o revise NEXT_PUBLIC_API_URL.`
          : undefined,
      };
    }
    if (e.estado >= 500) return { tipo: "servidor", titulo: "El catálogo tuvo un problema al cargar", mensaje: "Inténtelo de nuevo en unos minutos." };
    if (e.estado === 400) return { tipo: "validacion", titulo: "Revise los filtros", mensaje: e.message };
    return { tipo: "otro", titulo: "No se pudo cargar el catálogo", mensaje: e.message };
  }
  return { tipo: "otro", titulo: "No se pudo cargar el catálogo", mensaje: "Inténtelo de nuevo." };
}

// ───── Consulta ─────

/**
 * Consulta la página de productos que corresponde a los filtros. Mientras llega una respuesta nueva conserva los datos
 * anteriores (para atenuarlos en vez de vaciar la cuadrícula); `reintentar()` repite la última consulta.
 */
export function useCatalogo(filtros: FiltrosCatalogo) {
  const clave = escribirFiltros(filtros);
  const [version, setVersion] = useState(0);
  const [estado, setEstado] = useState<{ id: string; datos?: Pagina<ProductoCatalogo>; error?: unknown }>({ id: "" });
  const id = `${clave}#${version}`;

  useEffect(() => {
    let activo = true;
    const f = leerFiltros(new URLSearchParams(clave));
    buscarCatalogo({ ...f, limite: LIMITE_CATALOGO }).then(
      (datos) => activo && setEstado({ id, datos }),
      (error: unknown) => activo && setEstado({ id, error }),
    );
    return () => {
      activo = false;
    };
  }, [clave, id]);

  const actual = estado.id === id;
  return {
    /** Datos de la consulta actual o, mientras carga, los de la anterior. */
    datos: estado.datos,
    error: actual ? estado.error : undefined,
    cargando: !actual,
    reintentar: () => setVersion((v) => v + 1),
  };
}
