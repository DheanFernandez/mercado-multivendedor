import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));

import { ErrorApi, MENSAJE_ERROR_SERVIDOR, MENSAJE_NO_API, MENSAJE_SIN_CONEXION, buscarCatalogo } from "@/lib/api";

const respuesta = (status: number, cuerpo: string, tipo: string) => new Response(cuerpo, { status, headers: { "content-type": tipo } });
const json = (status: number, cuerpo: unknown) => respuesta(status, JSON.stringify(cuerpo), "application/json; charset=utf-8");

async function fallo(p: Promise<unknown>): Promise<ErrorApi> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ErrorApi);
    return e as ErrorApi;
  }
  throw new Error("se esperaba un ErrorApi");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("peticion() · clasificación de errores (spec 004, CA-CAT-08, CA-CAT-12)", () => {
  it("si la solicitud no llega (API apagada, red o CORS) conserva el mensaje de siempre", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const e = await fallo(buscarCatalogo({}));
    expect(e.estado).toBe(0);
    expect(e.message).toBe(MENSAJE_SIN_CONEXION);
    expect(e.message).toBe("No se pudo conectar con el servidor.");
    expect(e.codigo).toBe("SIN_CONEXION");
  });

  it("una página HTML (p. ej. el 404 de Next.js en el puerto de la API) se informa como «no es la API», no como «Error inesperado.»", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta(404, "<!DOCTYPE html><html></html>", "text/html; charset=utf-8")));
    const e = await fallo(buscarCatalogo({}));
    expect(e.estado).toBe(404);
    expect(e.codigo).toBe("RESPUESTA_NO_API");
    expect(e.message).toBe(MENSAJE_NO_API);
    expect(e.message).not.toMatch(/inesperado/i);
  });

  it("un 200 que no es JSON tampoco se acepta como datos", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta(200, "<html></html>", "text/html")));
    expect((await fallo(buscarCatalogo({}))).codigo).toBe("RESPUESTA_NO_API");
  });

  it("un 500 de NestJS sin `mensaje` es un error del servidor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(500, { statusCode: 500, message: "Internal server error" })));
    const e = await fallo(buscarCatalogo({}));
    expect(e.estado).toBe(500);
    expect(e.codigo).toBe("ERROR_SERVIDOR");
    expect(e.message).toBe(MENSAJE_ERROR_SERVIDOR);
  });

  it("un error de dominio conserva el mensaje y el código del backend", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(400, { statusCode: 400, codigo: "VALIDACION", mensaje: "El precio mínimo no puede superar al máximo." })));
    const e = await fallo(buscarCatalogo({ precioMin: "9", precioMax: "1" }));
    expect(e.estado).toBe(400);
    expect(e.codigo).toBe("VALIDACION");
    expect(e.message).toBe("El precio mínimo no puede superar al máximo.");
  });

  it("un 4xx JSON sin `mensaje` usa un texto genérico, nunca «Error inesperado.»", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(404, { statusCode: 404, message: "Cannot GET /x" })));
    const e = await fallo(buscarCatalogo({}));
    expect(e.message).toBe("No se pudo completar la operación.");
    expect(e.codigo).toBeUndefined();
  });

  it("una respuesta JSON correcta se devuelve tal cual y la consulta omite los filtros vacíos", async () => {
    const pagina = { datos: [], pagina: 1, limite: 24, total: 0, totalPaginas: 0 };
    const f = vi.fn().mockResolvedValue(json(200, pagina));
    vi.stubGlobal("fetch", f);
    await expect(buscarCatalogo({ pagina: 1, limite: 24, orden: "recientes", q: undefined, categoriaId: "" })).resolves.toEqual(pagina);
    expect(String(f.mock.calls[0]![0])).toMatch(/\/api\/v1\/catalogo\/productos\?pagina=1&limite=24&orden=recientes$/);
  });
});
