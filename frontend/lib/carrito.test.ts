import { describe, expect, it } from "vitest";
import { ErrorApi } from "@/lib/api";
import { esSesionCaducada, mensajeErrorCarrito, rotuloPuesto, textoEstadoLinea, validarCantidad } from "@/lib/carrito";
import type { LineaCarrito } from "@/lib/tipos";

const linea = (p: Partial<LineaCarrito>): LineaCarrito => ({
  productoId: "p", nombre: "Mango", unidadVenta: "KILOGRAMO", presentacion: null, cantidad: 2,
  precioUnitario: "6.50", subtotal: "13.00", estado: "OK", disponible: 10, ...p,
});

describe("validarCantidad (CA-F4)", () => {
  it("acepta enteros de 1 a 10000", () => {
    expect(validarCantidad("1")).toEqual({ ok: true, valor: 1 });
    expect(validarCantidad(" 25 ")).toEqual({ ok: true, valor: 25 });
    expect(validarCantidad("10000")).toEqual({ ok: true, valor: 10000 });
  });
  it.each(["", "  ", "0", "-1", "1.5", "1,5", "abc", "1e2", "+3", "10001", "0010x"])("rechaza %j", (t) => {
    const r = validarCantidad(t);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensaje.length).toBeGreaterThan(5);
  });
});

describe("mensajeErrorCarrito (CA-F7)", () => {
  it("muestra el mensaje del servidor (409 con unidades disponibles, 404, 400)", () => {
    expect(mensajeErrorCarrito(new ErrorApi(409, "No hay stock suficiente: quedan 3 unidad(es) disponibles."))).toMatch(/quedan 3/);
    expect(mensajeErrorCarrito(new ErrorApi(404, "El producto no está disponible."))).toBe("El producto no está disponible.");
    expect(mensajeErrorCarrito(new ErrorApi(400, "La cantidad debe ser mayor que cero."))).toMatch(/cantidad/);
  });
  it("sin conexión (estado 0) conserva el texto de red y 401 pide ingresar de nuevo", () => {
    expect(mensajeErrorCarrito(new ErrorApi(0, "No se pudo conectar con el servidor."))).toMatch(/conectar/);
    expect(mensajeErrorCarrito(new ErrorApi(401, "Autenticación requerida."))).toMatch(/sesión/i);
  });
  it("un error desconocido da un mensaje genérico", () => {
    expect(mensajeErrorCarrito(new Error("boom"))).toBe("No se pudo completar la operación.");
  });
  it("esSesionCaducada solo es verdadero para 401", () => {
    expect(esSesionCaducada(new ErrorApi(401, "x"))).toBe(true);
    expect(esSesionCaducada(new ErrorApi(409, "x"))).toBe(false);
    expect(esSesionCaducada(new Error("x"))).toBe(false);
  });
});

describe("rotuloPuesto", () => {
  it("muestra código y nombre", () => {
    expect(rotuloPuesto({ id: "1", codigo: "A-1", nombre: "Puesto A" })).toBe("A-1 · Puesto A");
  });
  it("sin datos del puesto: «Puesto no disponible»", () => {
    expect(rotuloPuesto({ id: "1", codigo: null, nombre: null })).toBe("Puesto no disponible");
  });
});

describe("textoEstadoLinea (CA-F6)", () => {
  it("una línea vigente no lleva aviso", () => {
    expect(textoEstadoLinea(linea({}))).toBeNull();
  });
  it("stock insuficiente indica cuántas quedan; con 0, «Agotado»", () => {
    expect(textoEstadoLinea(linea({ estado: "STOCK_INSUFICIENTE", disponible: 3 }))).toBe("Quedan 3");
    expect(textoEstadoLinea(linea({ estado: "STOCK_INSUFICIENTE", disponible: 0 }))).toBe("Agotado");
  });
  it("producto no disponible", () => {
    expect(textoEstadoLinea(linea({ estado: "NO_DISPONIBLE", nombre: null }))).toBe("Este producto ya no está disponible");
  });
});
