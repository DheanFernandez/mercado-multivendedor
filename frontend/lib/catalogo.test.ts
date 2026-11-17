import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: () => ({}) }));

import { ErrorApi, MENSAJE_NO_API } from "@/lib/api";
import * as catalogo from "@/lib/catalogo";
import { FILTROS_VACIOS, ORDENES, cambiarFiltros, claveCategoria, clasificarError, escribirFiltros, etiquetasFiltros, hayFiltros, leerFiltros } from "@/lib/catalogo";

const CAT = "11111111-1111-4111-8111-111111111111";
const PUESTO = "22222222-2222-4222-8222-222222222222";
const qs = (s: string) => new URLSearchParams(s);

describe("filtros ↔ URL (spec 004, CA-CAT-11)", () => {
  it("sin parámetros: primera página, más recientes y sin filtros (CA-CAT-01)", () => {
    expect(leerFiltros(qs(""))).toEqual({ orden: "recientes", pagina: 1, q: undefined, categoriaId: undefined, puestoId: undefined });
    expect(escribirFiltros(FILTROS_VACIOS)).toBe("");
  });

  it("ida y vuelta conserva búsqueda, categoría, puesto, orden y página", () => {
    const f = leerFiltros(qs(`q=papa&categoriaId=${CAT}&puestoId=${PUESTO}&orden=precio_asc&pagina=3`));
    expect(f).toEqual({ q: "papa", categoriaId: CAT, puestoId: PUESTO, orden: "precio_asc", pagina: 3 });
    expect(leerFiltros(qs(escribirFiltros(f)))).toEqual(f);
  });

  it("ignora valores no válidos en vez de enviarlos a la API", () => {
    const f = leerFiltros(qs("categoriaId=abc&puestoId=1&orden=raro&pagina=0&q=%20%20"));
    expect(f).toEqual({ ...FILTROS_VACIOS, q: undefined, categoriaId: undefined, puestoId: undefined });
    expect(leerFiltros(qs("pagina=2.5")).pagina).toBe(1);
    expect(leerFiltros(qs(`q=${"a".repeat(150)}`)).q).toHaveLength(100);
  });

  it("cambiar un filtro vuelve a la página 1; cambiar solo la página la conserva", () => {
    const f = { ...FILTROS_VACIOS, pagina: 4 };
    expect(cambiarFiltros(f, { q: "leche" }).pagina).toBe(1);
    expect(cambiarFiltros(f, { categoriaId: CAT }).pagina).toBe(1);
    expect(cambiarFiltros(f, { pagina: 5 }).pagina).toBe(5);
  });

  it("el orden y la página no cuentan como filtros; la categoría y el puesto sí", () => {
    expect(hayFiltros({ ...FILTROS_VACIOS, orden: "nombre", pagina: 9 })).toBe(false);
    expect(hayFiltros({ ...FILTROS_VACIOS, categoriaId: CAT })).toBe(true);
    expect(hayFiltros({ ...FILTROS_VACIOS, puestoId: PUESTO })).toBe(true);
  });
});

describe("sin filtro de precio en la interfaz (E1, CA-CAT-19)", () => {
  it("precioMin y precioMax de la URL se ignoran y no se vuelven a escribir", () => {
    const f = leerFiltros(qs(`precioMin=5&precioMax=10&categoriaId=${CAT}`));
    expect(f).toEqual({ ...FILTROS_VACIOS, q: undefined, categoriaId: CAT, puestoId: undefined });
    expect(f).not.toHaveProperty("precioMin");
    expect(f).not.toHaveProperty("precioMax");
    expect(escribirFiltros(f)).toBe(`categoriaId=${CAT}`);
    expect(hayFiltros(leerFiltros(qs("precioMax=5")))).toBe(false);
  });

  it("ya no existen los rangos rápidos ni su validación", () => {
    for (const retirado of ["RANGOS_PRECIO", "validarRango", "textoRangoPrecio", "filtrosDelPanel"]) expect(catalogo).not.toHaveProperty(retirado);
  });

  it("solo ofrece los órdenes del contrato (no existe «relevancia»: E1-A2)", () => {
    expect(ORDENES.map((o) => o.valor)).toEqual(["recientes", "nombre", "precio_asc", "precio_desc"]);
  });
});

describe("etiquetas de filtros activos", () => {
  it("describe búsqueda, categoría y puesto, y cómo quitar cada uno", () => {
    const e = etiquetasFiltros({ ...FILTROS_VACIOS, q: "papa", categoriaId: CAT, puestoId: PUESTO }, [{ id: CAT, nombre: "Verduras" }], [{ id: PUESTO, codigo: "A-12", nombre: "Puesto" }]);
    expect(e.map((x) => x.texto)).toEqual(["«papa»", "Verduras", "Puesto A-12"]);
    expect(e[1]!.quitar).toEqual({ categoriaId: undefined });
  });

  it("si la categoría o el puesto no están en las listas, usa un texto genérico", () => {
    expect(etiquetasFiltros({ ...FILTROS_VACIOS, categoriaId: CAT, puestoId: PUESTO }).map((x) => x.texto)).toEqual(["Categoría", "Puesto"]);
  });
});

describe("icono de categoría por slug (E1-A4)", () => {
  it.each([
    ["frutas", "frutas"],
    ["verduras", "verduras"],
    ["hortalizas", "hortalizas"],
    ["tuberculos", "tuberculos"],
    ["abarrotes", "abarrotes"],
    ["lacteos", "lacteos"],
    ["carnes", "carnes"],
    ["pescados", "pescados"],
    ["panaderia", "panaderia"],
    ["frutos-del-mar", "pescados"],
    ["lacteos-y-derivados", "lacteos"],
    ["carnes-y-aves", "carnes"],
    ["huevos", "huevos"],
    ["menestras", "granos"],
  ])("«%s» → %s", (slug, clave) => {
    expect(claveCategoria(slug)).toBe(clave);
  });

  it("si el slug no dice nada, usa el nombre; si tampoco, el icono genérico", () => {
    expect(claveCategoria("cat-7", "Lácteos")).toBe("lacteos");
    expect(claveCategoria("bebidas", "Bebidas")).toBe("otra");
    expect(claveCategoria("papaya")).toBe("otra"); // «papa» solo cuenta como palabra completa
    expect(claveCategoria("papas-nativas")).toBe("tuberculos");
  });
});

describe("clasificarError (CA-CAT-08)", () => {
  it("distingue sin conexión, respuesta que no es de la API, error del servidor y filtro no válido", () => {
    expect(clasificarError(new ErrorApi(0, "No se pudo conectar con el servidor.", "SIN_CONEXION")).tipo).toBe("conexion");
    expect(clasificarError(new ErrorApi(404, MENSAJE_NO_API, "RESPUESTA_NO_API")).tipo).toBe("no-api");
    expect(clasificarError(new ErrorApi(500, "x", "ERROR_SERVIDOR")).tipo).toBe("servidor");
    expect(clasificarError(new ErrorApi(503, "La base no responde", "SERVICIO_NO_DISPONIBLE")).tipo).toBe("servidor");
    const v = clasificarError(new ErrorApi(400, "El orden debe ser uno de: recientes.", "VALIDACION"));
    expect(v).toMatchObject({ tipo: "validacion", mensaje: "El orden debe ser uno de: recientes." });
    expect(clasificarError(new Error("raro")).tipo).toBe("otro");
  });

  it("nunca produce «Error inesperado.» y solo da pistas técnicas en desarrollo", () => {
    const e = new ErrorApi(404, MENSAJE_NO_API, "RESPUESTA_NO_API");
    expect(JSON.stringify(clasificarError(e))).not.toMatch(/inesperado/i);
    expect(clasificarError(e).pista).toBeUndefined();
    expect(clasificarError(e, true).pista).toMatch(/NEXT_PUBLIC_API_URL/);
    expect(clasificarError(new ErrorApi(0, "x", "SIN_CONEXION"), true).pista).toMatch(/backend/);
  });
});
