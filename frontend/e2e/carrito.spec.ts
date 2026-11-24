/**
 * Prueba de navegador del carrito (spec 002-carrito, T027/T028) con RED SIMULADA.
 *
 * El navegador es real (Chromium) y la aplicación Next.js es la real, pero NO hay backend ni Supabase reales:
 * la sesión de Supabase se simula con una cookie y todas las llamadas a `/api/v1/**` se interceptan con una API
 * falsa que reproduce el contrato de specs/002-carrito/contracts/api-carrito.md. Por eso esta prueba verifica la
 * interfaz, no la integración con el backend (que cubren backend/test/carrito.e2e-spec.ts y carrito.db-spec.ts).
 */
import { type BrowserContext, type Page, type Route, expect, test } from "@playwright/test";

const API = "http://localhost:3999";
const SUPABASE = "http://localhost:54321";

// ───── Sesión simulada de Supabase ─────
const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = () => `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: "u1", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.firma`;

async function iniciarSesion(context: BrowserContext) {
  const ahora = Math.floor(Date.now() / 1000);
  const sesion = {
    access_token: jwt(), token_type: "bearer", expires_in: 3600, expires_at: ahora + 3600, refresh_token: "refresh-de-prueba",
    user: { id: "u1", aud: "authenticated", role: "authenticated", email: "cliente@prueba.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  };
  await context.addCookies([{ name: "sb-localhost-auth-token", value: `base64-${b64url(sesion)}`, domain: "localhost", path: "/" }]);
}

// ───── API falsa (contrato de api-carrito.md; importes en céntimos enteros) ─────
interface Prod { id: string; nombre: string; centimos: number; unidad: string; stock: number; puesto: { id: string; codigo: string; nombre: string } }
const PRODUCTOS: Record<string, Prod> = {
  mango: { id: "mango", nombre: "Mango", centimos: 650, unidad: "KILOGRAMO", stock: 10, puesto: { id: "pa", codigo: "A-1", nombre: "Puesto A" } },
  cilantro: { id: "cilantro", nombre: "Cilantro", centimos: 10, unidad: "MANOJO", stock: 50, puesto: { id: "pb", codigo: "B-1", nombre: "Puesto B" } },
  palta: { id: "palta", nombre: "Palta", centimos: 1999, unidad: "KILOGRAMO", stock: 20, puesto: { id: "pc", codigo: "C-1", nombre: "Puesto C" } },
};
const sol = (c: number) => `${Math.trunc(c / 100)}.${String(c % 100).padStart(2, "0")}`;

class ApiFalsa {
  carrito = new Map<string, number>();
  llamadasCarrito: string[] = [];
  constructor(readonly rol: string) {}

  vista() {
    const grupos = new Map<string, { puesto: Prod["puesto"]; items: unknown[]; centimos: number }>();
    let total = 0;
    let unidades = 0;
    for (const [id, cantidad] of this.carrito) {
      const p = PRODUCTOS[id]!;
      const g = grupos.get(p.puesto.id) ?? { puesto: p.puesto, items: [], centimos: 0 };
      grupos.set(p.puesto.id, g);
      const sub = p.centimos * cantidad;
      g.centimos += sub;
      total += sub;
      unidades += cantidad;
      g.items.push({ productoId: id, nombre: p.nombre, unidadVenta: p.unidad, presentacion: null, cantidad, precioUnitario: sol(p.centimos), subtotal: sol(sub), estado: "OK", disponible: p.stock });
    }
    return { puestos: [...grupos.values()].map((g) => ({ puesto: g.puesto, items: g.items, subtotal: sol(g.centimos) })), total: sol(total), totalProductos: unidades, requiereRevision: false };
  }

  async atender(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const cors = { "access-control-allow-origin": "http://localhost:3210", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS" };
    const responder = (status: number, cuerpo: unknown) => route.fulfill({ status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });

    const ruta = url.pathname;
    if (ruta === "/api/v1/auth/me") {
      if (!req.headers()["authorization"]) return responder(401, { statusCode: 401, codigo: "NO_AUTENTICADO", mensaje: "Autenticación requerida." });
      return responder(200, { id: "u1", email: "cliente@prueba.test", nombres: "Ana", apellidos: "Prueba", telefono: null, rol: this.rol, estado: "ACTIVO" });
    }
    const detalle = /^\/api\/v1\/catalogo\/productos\/([^/]+)$/.exec(ruta);
    if (detalle) {
      const p = PRODUCTOS[detalle[1]!];
      if (!p) return responder(404, { statusCode: 404, codigo: "NO_ENCONTRADO", mensaje: "Producto no encontrado." });
      return responder(200, {
        id: p.id, nombre: p.nombre, descripcion: null, precio: sol(p.centimos), unidadVenta: p.unidad, presentacion: null,
        categoria: { id: "c1", nombre: "Frutas", slug: "frutas" }, puesto: p.puesto, imagenes: [],
      });
    }
    if (ruta.startsWith("/api/v1/carrito")) {
      this.llamadasCarrito.push(`${req.method()} ${ruta}`);
      if (this.rol !== "CLIENTE") return responder(403, { statusCode: 403, codigo: "PROHIBIDO", mensaje: "Solo los clientes pueden usar el carrito." });
      const item = /^\/api\/v1\/carrito\/items(?:\/([^/]+))?$/.exec(ruta);
      if (ruta === "/api/v1/carrito" && req.method() === "GET") return responder(200, this.vista());
      if (ruta === "/api/v1/carrito" && req.method() === "DELETE") { this.carrito.clear(); return responder(200, this.vista()); }
      if (item && req.method() === "POST") {
        const { productoId, cantidad } = req.postDataJSON() as { productoId: string; cantidad: number };
        const p = PRODUCTOS[productoId];
        if (!p) return responder(404, { statusCode: 404, codigo: "NO_ENCONTRADO", mensaje: "El producto no está disponible." });
        if ((this.carrito.get(productoId) ?? 0) + cantidad > p.stock) return responder(409, { statusCode: 409, codigo: "CONFLICTO", mensaje: `No hay stock suficiente: quedan ${p.stock} unidad(es) disponibles.` });
        this.carrito.set(productoId, (this.carrito.get(productoId) ?? 0) + cantidad);
        return responder(201, this.vista());
      }
      if (item?.[1] && req.method() === "PATCH") {
        const { cantidad } = req.postDataJSON() as { cantidad: number };
        const p = PRODUCTOS[item[1]];
        if (!this.carrito.has(item[1]) || !p) return responder(404, { statusCode: 404, codigo: "NO_ENCONTRADO", mensaje: "El producto no está en el carrito." });
        if (cantidad > p.stock) return responder(409, { statusCode: 409, codigo: "CONFLICTO", mensaje: `No hay stock suficiente: quedan ${p.stock} unidad(es) disponibles.` });
        this.carrito.set(item[1], cantidad);
        return responder(200, this.vista());
      }
      if (item?.[1] && req.method() === "DELETE") {
        if (!this.carrito.delete(item[1])) return responder(404, { statusCode: 404, codigo: "NO_ENCONTRADO", mensaje: "El producto no está en el carrito." });
        return responder(200, this.vista());
      }
    }
    return responder(404, { statusCode: 404, codigo: "NO_ENCONTRADO", mensaje: "Ruta no simulada." });
  }
}

async function preparar(page: Page, rol: string | null) {
  const api = new ApiFalsa(rol ?? "CLIENTE");
  // Ninguna llamada puede salir hacia servicios reales: Supabase se responde vacío y el resto de orígenes externos se bloquea.
  await page.route(`${SUPABASE}/**`, (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }));
  await page.route(`${API}/**`, (r) => api.atender(r));
  if (rol) await iniciarSesion(page.context());
  return api;
}

const agregarDesdeDetalle = async (page: Page, id: string, cantidad: string) => {
  await page.goto(`/catalogo/${id}`);
  await page.getByLabel("Cantidad", { exact: true }).fill(cantidad);
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
};

test.describe("Carrito · cliente (CA-F1…CA-F7, CA-F9, CA-F12)", () => {
  test("agrega desde el detalle, ve tres puestos con subtotales y total, modifica, falla por stock, quita y vacía", async ({ page }) => {
    await preparar(page, "CLIENTE");

    // CA-F1: agregar desde el detalle con confirmación y total
    await agregarDesdeDetalle(page, "mango", "3");
    await expect(page.getByRole("status").filter({ hasText: "Agregado al carrito" })).toContainText("S/ 19.50");
    await agregarDesdeDetalle(page, "cilantro", "3");
    await expect(page.getByRole("status").filter({ hasText: "Agregado al carrito" })).toContainText("S/ 19.80");
    await agregarDesdeDetalle(page, "palta", "3");
    await expect(page.getByRole("status").filter({ hasText: "Agregado al carrito" })).toContainText("S/ 79.77");

    // CA-F12: enlace «Carrito» en el encabezado (sin contador)
    const enlace = page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Carrito", exact: true });
    await expect(enlace).toHaveText("Carrito");
    await enlace.click();

    // CA-F2, CA-F3: grupos por puesto, subtotales y total exactos (0.30 y 59.97 delatarían errores de coma flotante)
    await expect(page.getByRole("heading", { name: "Mi carrito" })).toBeVisible();
    await expect(page.getByRole("region")).toHaveCount(3);
    await expect(page.getByRole("heading", { name: "A-1 · Puesto A" })).toBeVisible();
    await expect(page.getByText("Subtotal del puesto: S/ 19.50")).toBeVisible();
    await expect(page.getByText("Subtotal del puesto: S/ 0.30")).toBeVisible();
    await expect(page.getByText("Subtotal del puesto: S/ 59.97")).toBeVisible();
    await expect(page.getByText(/^Total:/)).toHaveText("Total: S/ 79.77");
    await expect(page.getByText(/Importe estimado/)).toBeVisible();
    // CA-F11: sin pedido ni pago
    await expect(page.getByRole("button", { name: /pedido|pagar|pago/i })).toHaveCount(0);

    // CA-F4: modificar cantidad
    await page.getByLabel("Cantidad de Mango").fill("10");
    await page.getByRole("region").filter({ hasText: "Puesto A" }).getByRole("button", { name: "Actualizar" }).click();
    await expect(page.getByText("Subtotal del puesto: S/ 65.00")).toBeVisible();
    await expect(page.getByText(/^Total:/)).toHaveText("Total: S/ 125.27");

    // CA-F7: 409 junto a la acción y el carrito conserva lo mostrado
    await page.getByLabel("Cantidad de Mango").fill("11");
    await page.getByRole("region").filter({ hasText: "Puesto A" }).getByRole("button", { name: "Actualizar" }).click();
    await expect(page.getByRole("alert")).toContainText("quedan 10 unidad(es)");
    await expect(page.getByText(/^Total:/)).toHaveText("Total: S/ 125.27");

    // CA-F4: cantidad inválida no llega al servidor
    const antes = await page.evaluate(() => performance.getEntriesByType("resource").length);
    await page.getByLabel("Cantidad de Palta").fill("1.5");
    await page.getByRole("region").filter({ hasText: "Puesto C" }).getByRole("button", { name: "Actualizar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "entera" })).toBeVisible();
    expect(await page.evaluate(() => performance.getEntriesByType("resource").length)).toBe(antes);

    // CA-F5: quitar; el puesto sin productos desaparece
    await page.getByRole("region").filter({ hasText: "Puesto B" }).getByRole("button", { name: "Quitar" }).click();
    await expect(page.getByRole("region")).toHaveCount(2);
    await expect(page.getByRole("heading", { name: "B-1 · Puesto B" })).toHaveCount(0);
    await expect(page.getByText(/^Total:/)).toHaveText("Total: S/ 124.97");

    // CA-F5: vaciar con confirmación
    await page.getByRole("button", { name: "Vaciar carrito" }).click();
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("region")).toHaveCount(2);
    await page.getByRole("button", { name: "Vaciar carrito" }).click();
    await page.getByRole("button", { name: "Confirmar" }).click();

    // CA-F9: vacío
    await expect(page.getByText("Su carrito está vacío.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver el catálogo" })).toHaveAttribute("href", "/catalogo");
  });

  test("agregar más que el stock desde el detalle muestra el error y no agrega", async ({ page }) => {
    const api = await preparar(page, "CLIENTE");
    await agregarDesdeDetalle(page, "mango", "11");
    await expect(page.getByRole("alert")).toContainText("quedan 10 unidad(es)");
    expect(api.carrito.size).toBe(0);
  });
});

test.describe("Carrito · sin permiso (CA-F8, CA-F12)", () => {
  test("el visitante es llevado a /login desde /carrito y en el detalle ve «Ingresar para comprar»", async ({ page }) => {
    const api = await preparar(page, null);
    await page.goto("/carrito");
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/catalogo/mango");
    await expect(page.getByRole("link", { name: "Ingresar para comprar" })).toHaveAttribute("href", "/login");
    await expect(page.getByRole("button", { name: "Agregar al carrito" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Carrito", exact: true })).toHaveCount(0);
    expect(api.llamadasCarrito).toEqual([]);
  });

  for (const rol of ["COMERCIANTE", "ADMINISTRADOR"]) {
    test(`${rol} ve «Acceso restringido» en /carrito y el aviso en el detalle, sin enlace «Carrito»`, async ({ page }) => {
      const api = await preparar(page, rol);
      await page.goto("/carrito");
      await expect(page.getByText("Acceso restringido")).toBeVisible();
      await page.goto("/catalogo/mango");
      await expect(page.getByText(/Solo los clientes compran/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Agregar al carrito" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Carrito", exact: true })).toHaveCount(0);
      expect(api.llamadasCarrito).toEqual([]);
    });
  }
});

test.describe("Carrito · pantalla estrecha (CA-F10)", () => {
  test("a 375 px el detalle y el carrito no desbordan horizontalmente", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await preparar(page, "CLIENTE");
    const sinDesborde = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    await agregarDesdeDetalle(page, "mango", "3");
    await expect(page.getByRole("status").filter({ hasText: "Agregado al carrito" })).toBeVisible();
    expect(await sinDesborde()).toBe(true);
    await agregarDesdeDetalle(page, "palta", "2");
    await expect(page.getByRole("status").filter({ hasText: "Agregado al carrito" })).toBeVisible();
    await page.goto("/carrito");
    await expect(page.getByRole("region")).toHaveCount(2);
    expect(await sinDesborde()).toBe(true);
  });
});
