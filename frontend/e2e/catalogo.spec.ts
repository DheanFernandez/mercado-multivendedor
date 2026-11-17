/**
 * Prueba de navegador del catálogo público (spec 004-catalogo-publico y enmienda E1) con RED SIMULADA.
 *
 * Chromium y la aplicación Next.js son reales; la API no: las llamadas a `/api/v1/**` se responden con una API falsa que
 * reproduce el contrato existente de `GET /api/v1/catalogo/productos`. Los productos y categorías de abajo existen solo en
 * esta prueba (la experiencia real nunca muestra datos de ejemplo: CA-CAT-06, CA-CAT-13).
 */
import { type Page, type Route, expect, test } from "@playwright/test";

const API = "http://localhost:3999";
const SUPABASE = "http://localhost:54321";
const CORS = { "access-control-allow-origin": "http://localhost:3210", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,OPTIONS" };

const uuid = (prefijo: string, n: number) => `${prefijo}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CATEGORIAS = [
  { id: uuid("c0000001", 1), nombre: "Frutas", slug: "frutas", descripcion: null, activa: true },
  { id: uuid("c0000002", 2), nombre: "Verduras", slug: "verduras", descripcion: null, activa: true },
  { id: uuid("c0000003", 3), nombre: "Tubérculos", slug: "tuberculos", descripcion: null, activa: true },
  { id: uuid("c0000004", 4), nombre: "Lácteos", slug: "lacteos", descripcion: null, activa: true },
];
const PUESTOS = [
  { id: uuid("a0000001", 1), codigo: "A-12", nombre: "Puesto Uno" },
  { id: uuid("a0000002", 2), codigo: "B-03", nombre: "Puesto Dos" },
];
const PRODUCTOS = Array.from({ length: 30 }, (_, i) => ({
  id: uuid("b0000000", i + 1),
  nombre: `Producto ${i + 1}`,
  descripcion: null,
  precio: `${(i % 12) + 1}.50`,
  unidadVenta: "KILOGRAMO",
  presentacion: null,
  categoria: CATEGORIAS[i % 2]!,
  puesto: PUESTOS[i % 2]!,
  imagenes: [],
}));

type Modo = "ok" | "vacio" | "html404" | "sin-conexion" | "error500";

class ApiFalsa {
  modo: Modo = "ok";
  consultas: URLSearchParams[] = [];

  async atender(route: Route) {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    const json = (status: number, cuerpo: unknown) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
    if (url.pathname === "/api/v1/categorias") return json(200, CATEGORIAS);
    if (url.pathname === "/api/v1/puestos/publicos") return json(200, PUESTOS);
    const detalle = /^\/api\/v1\/catalogo\/productos\/([^/]+)$/.exec(url.pathname);
    if (detalle) {
      const p = PRODUCTOS.find((x) => x.id === detalle[1]);
      return p ? json(200, p) : json(404, { statusCode: 404, codigo: "NO_ENCONTRADO", mensaje: "Producto no encontrado." });
    }
    if (url.pathname === "/api/v1/catalogo/productos") {
      this.consultas.push(url.searchParams);
      if (this.modo === "sin-conexion") return route.abort("connectionrefused");
      // Lo que ocurría en el diagnóstico: el puerto de la API lo ocupaba Next.js y respondía su página 404.
      if (this.modo === "html404") return route.fulfill({ status: 404, headers: { ...CORS, "content-type": "text/html; charset=utf-8" }, body: "<!DOCTYPE html><html><body>404</body></html>" });
      if (this.modo === "error500") return json(500, { statusCode: 500, message: "Internal server error" });
      const s = url.searchParams;
      const q = s.get("q")?.toLowerCase();
      let lista = this.modo === "vacio" ? [] : PRODUCTOS.filter(
        (p) =>
          (!q || p.nombre.toLowerCase().includes(q)) &&
          (!s.get("categoriaId") || p.categoria.id === s.get("categoriaId")) &&
          (!s.get("puestoId") || p.puesto.id === s.get("puestoId")),
      );
      if (s.get("orden") === "nombre") lista = [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre));
      const pagina = Number(s.get("pagina") ?? 1);
      const limite = Number(s.get("limite") ?? 20);
      return json(200, { datos: lista.slice((pagina - 1) * limite, pagina * limite), pagina, limite, total: lista.length, totalPaginas: Math.ceil(lista.length / limite) });
    }
    return json(404, { statusCode: 404, codigo: "NO_ENCONTRADO", mensaje: "Ruta no simulada." });
  }
}

async function preparar(page: Page) {
  const api = new ApiFalsa();
  await page.route(`${SUPABASE}/**`, (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }));
  await page.route(`${API}/**`, (r) => api.atender(r));
  return api;
}

const panelLateral = (page: Page) => page.getByRole("complementary", { name: "Categorías" });
const marca = (page: Page) => page.getByRole("button", { name: "Mercado de Abastos: panel de categorías" });
const primeraTarjeta = (page: Page) => page.getByRole("region", { name: /productos|Verduras|Frutas/ }).getByRole("link").first();
const sinDesborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const topeDocumento = async (page: Page) => {
  const caja = await primeraTarjeta(page).boundingBox();
  return (caja?.y ?? Infinity) + (await page.evaluate(() => window.scrollY));
};
/** Columnas reales de la cuadrícula: posiciones horizontales distintas de las tarjetas. */
const columnas = (page: Page) =>
  page.$$eval("[data-panel] > section > ul > li", (lis) => new Set(lis.map((li) => Math.round(li.getBoundingClientRect().left))).size);
/** Espera a que termine la transición del panel (≤ 300 ms) y la cuadrícula deje de cambiar. */
async function columnasEstables(page: Page) {
  let previo = -1;
  await expect
    .poll(async () => {
      const ahora = await columnas(page);
      const estable = ahora === previo;
      previo = ahora;
      return estable;
    }, { intervals: [350, 150, 150, 300] })
    .toBe(true);
  return previo;
}

test.describe("Catálogo · carga automática y prioridad de los productos (CA-CAT-01, CA-CAT-02, CA-CAT-13)", () => {
  test("escritorio: primera página sin filtros, tarjetas arriba y categorías reales en la barra lateral", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const api = await preparar(page);
    await page.goto("/catalogo");
    await expect(page.getByRole("heading", { name: "Producto 1", exact: true })).toBeVisible();
    await expect(page.getByText("30 productos")).toBeVisible();
    expect(api.consultas.length).toBeGreaterThan(0); // en desarrollo, el modo estricto de React puede repetir la consulta
    for (const s of api.consultas) {
      expect(Object.fromEntries(s)).toEqual({ pagina: "1", limite: "24", orden: "recientes" });
    }
    await expect(primeraTarjeta(page)).toHaveAttribute("href", `/catalogo/${PRODUCTOS[0]!.id}`);
    expect(await topeDocumento(page)).toBeLessThanOrEqual(360);
    const panel = panelLateral(page);
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("button")).toHaveText(["Todos", ...CATEGORIAS.map((c) => c.nombre)]);
    await expect(panel.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/inesperado/i)).toHaveCount(0);
    // Sin filtro de precio (CA-CAT-19)
    await expect(page.getByText(/rango de precio/i)).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: /precio|mín|máx/i })).toHaveCount(0);
  });

  test("móvil: tarjetas arriba, sin desborde y sin panel ocupando espacio", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await preparar(page);
    await page.goto("/catalogo");
    await expect(page.getByRole("heading", { name: "Producto 1", exact: true })).toBeVisible();
    expect(await topeDocumento(page)).toBeLessThanOrEqual(420);
    expect(await sinDesborde(page)).toBe(true);
    await expect(panelLateral(page)).toBeHidden();
    expect(await columnas(page)).toBe(2);
    await page.setViewportSize({ width: 360, height: 780 });
    expect(await sinDesborde(page)).toBe(true);
  });
});

test.describe("Catálogo · el logotipo oculta y muestra la barra lateral (CA-CAT-15, CA-CAT-16, CA-CAT-18)", () => {
  test("escritorio: ocultar el panel amplía la cuadrícula; mostrarlo la reorganiza sin desbordes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const api = await preparar(page);
    await page.goto("/catalogo");
    await expect(page.getByRole("heading", { name: "Producto 1", exact: true })).toBeVisible();

    const boton = marca(page);
    const panel = panelLateral(page);
    await expect(boton).toHaveAttribute("aria-expanded", "true");
    await expect(boton).toHaveAttribute("aria-controls", "panel-categorias");
    const conPanel = await columnasEstables(page);
    expect(conPanel).toBeGreaterThanOrEqual(3);

    // Transición suave y acotada: grid-template-columns en 300 ms.
    const transicion = await page.locator("[data-panel]").evaluate((el) => ({ propiedad: getComputedStyle(el).transitionProperty, duracion: getComputedStyle(el).transitionDuration }));
    expect(transicion).toEqual({ propiedad: "grid-template-columns", duracion: "0.3s" });

    const consultasAntes = api.consultas.length;
    await boton.click();
    await expect(boton).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toHaveAttribute("inert", "");
    await expect(panel.getByRole("button", { name: "Frutas" })).toBeHidden();
    const sinPanel = await columnasEstables(page);
    expect(sinPanel).toBeGreaterThan(conPanel);
    expect(await sinDesborde(page)).toBe(true);
    expect(api.consultas.length).toBe(consultasAntes); // ocultar el panel no vuelve a consultar
    // La cuadrícula ocupa todo el ancho del contenido.
    const anchos = await page.evaluate(() => {
      const r = document.querySelector("[data-panel]")!.getBoundingClientRect();
      const s = document.querySelector("[data-panel] > section")!.getBoundingClientRect();
      return { rejilla: Math.round(r.width), seccion: Math.round(s.width) };
    });
    expect(anchos.seccion).toBe(anchos.rejilla);
    // Oculto, el panel no recibe el foco.
    await page.getByRole("searchbox", { name: "Buscar productos" }).focus();
    await page.keyboard.press("Tab"); // «Buscar»
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.closest("#panel-categorias") === null)).toBe(true);

    await boton.click();
    await expect(boton).toHaveAttribute("aria-expanded", "true");
    await expect(panel).not.toHaveAttribute("inert", "");
    await expect(panel.getByRole("button", { name: "Frutas" })).toBeVisible();
    expect(await columnasEstables(page)).toBe(conPanel);
    expect(await sinDesborde(page)).toBe(true);
    await expect(boton).toBeFocused();
  });

  test("sin desbordes en ambos estados a 1024 px y con movimiento reducido no hay transición", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1024, height: 768 });
    await preparar(page);
    await page.goto("/catalogo");
    await expect(page.getByRole("heading", { name: "Producto 1", exact: true })).toBeVisible();
    expect(await page.locator("[data-panel]").evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
    const conPanel = await columnasEstables(page);
    expect(await sinDesborde(page)).toBe(true);
    await marca(page).click();
    await expect(panelLateral(page)).toHaveAttribute("inert", "");
    expect(await columnasEstables(page)).toBeGreaterThan(conPanel);
    expect(await sinDesborde(page)).toBe(true);
  });

  test("el estado del panel se conserva al ir al detalle y volver; «Inicio» lleva al inicio", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await preparar(page);
    await page.goto("/catalogo");
    await marca(page).click();
    await expect(panelLateral(page)).toHaveAttribute("inert", "");
    await page.getByRole("heading", { name: "Producto 3", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/catalogo/${PRODUCTOS[2]!.id}$`));
    // Fuera del catálogo el logotipo vuelve a ser un enlace al inicio.
    await expect(page.getByRole("link", { name: "Mercado de Abastos" })).toHaveAttribute("href", "/");
    await page.goBack();
    await expect(marca(page)).toHaveAttribute("aria-expanded", "false");
    await expect(panelLateral(page)).toHaveAttribute("inert", "");

    await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Inicio" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "Mercado de Abastos" })).toBeVisible();
  });
});

test.describe("Catálogo · categorías, URL y estados (CA-CAT-06, CA-CAT-07, CA-CAT-11, CA-CAT-14)", () => {
  test("la categoría filtra al instante, se resalta, queda en la URL y «Atrás» desde el detalle restaura la vista", async ({ page }) => {
    const api = await preparar(page);
    await page.goto("/catalogo");
    const panel = panelLateral(page);
    await panel.getByRole("button", { name: "Verduras", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`categoriaId=${CATEGORIAS[1]!.id}`));
    await expect(page.getByRole("heading", { level: 2, name: "Verduras" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Verduras" })).toHaveAttribute("aria-pressed", "true");
    await expect(panel.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => api.consultas.at(-1)?.get("categoriaId")).toBe(CATEGORIAS[1]!.id);
    await expect(page.getByText("15 productos")).toBeVisible();
    await expect(page.getByRole("button", { name: /aplicar/i })).toHaveCount(0);

    await page.getByRole("heading", { name: "Producto 2", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/catalogo/${PRODUCTOS[1]!.id}$`));
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`categoriaId=${CATEGORIAS[1]!.id}`));
    await expect(panel.getByRole("button", { name: "Verduras", exact: true })).toHaveAttribute("aria-pressed", "true");

    await panel.getByRole("button", { name: "Todos" }).click();
    await expect(page).toHaveURL(/\/catalogo$/);
    await expect(page.getByText("30 productos")).toBeVisible();
    await expect.poll(() => api.consultas.at(-1)?.has("categoriaId")).toBe(false);
  });

  test("una URL con precioMin/precioMax no envía esos parámetros (CA-CAT-19)", async ({ page }) => {
    const api = await preparar(page);
    await page.goto("/catalogo?precioMin=5&precioMax=10&orden=precio_asc");
    await expect(page.getByText("30 productos")).toBeVisible();
    for (const s of api.consultas) {
      expect(s.has("precioMin")).toBe(false);
      expect(s.has("precioMax")).toBe(false);
      expect(s.get("orden")).toBe("precio_asc");
    }
    await expect(page.getByRole("list", { name: "Filtros activos" })).toHaveCount(0);
  });

  test("búsqueda sin resultados: mensaje propio y «Limpiar filtros» vuelve a todos los productos", async ({ page }) => {
    await preparar(page);
    await page.goto("/catalogo");
    await page.getByRole("searchbox", { name: "Buscar productos" }).fill("zzz");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByRole("heading", { name: "No encontramos productos con esos filtros" })).toBeVisible();
    await expect(page).toHaveURL(/\?q=zzz$/);
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page.getByText("30 productos")).toBeVisible();
    await expect(page).toHaveURL(/\/catalogo$/);
  });

  test("catálogo vacío: «Todavía no hay productos publicados»", async ({ page }) => {
    const api = await preparar(page);
    api.modo = "vacio";
    await page.goto("/catalogo");
    await expect(page.getByRole("heading", { name: "Todavía no hay productos publicados" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Limpiar filtros" })).toHaveCount(0);
  });
});

test.describe("Catálogo · panel superpuesto en móvil (CA-CAT-17)", () => {
  test("el logotipo abre el panel; elegir una categoría la aplica, lo cierra y devuelve el foco", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const api = await preparar(page);
    await page.goto("/catalogo");
    await expect(page.getByRole("heading", { name: "Producto 1", exact: true })).toBeVisible();

    const boton = marca(page);
    await expect(boton).toHaveAttribute("aria-expanded", "false");
    await expect(boton).toHaveAttribute("aria-controls", "panel-categorias-movil");
    await boton.click();
    const dialogo = page.getByRole("dialog", { name: "Categorías" });
    await expect(dialogo).toBeVisible();
    await expect(boton).toHaveAttribute("aria-expanded", "true");
    // Superpuesto desde la izquierda, sin desplazar la página.
    await expect.poll(async () => (await dialogo.boundingBox())?.x).toBe(0);
    expect(await sinDesborde(page)).toBe(true);

    await dialogo.getByRole("button", { name: "Tubérculos" }).click();
    await expect(dialogo).toBeHidden();
    await expect.poll(() => api.consultas.at(-1)?.get("categoriaId")).toBe(CATEGORIAS[2]!.id);
    await expect(page.getByRole("heading", { level: 2, name: "Tubérculos" })).toBeVisible();
    await expect(boton).toHaveAttribute("aria-expanded", "false");
    await expect(boton).toBeFocused();
  });

  test("«Categorías» lo abre; se cierra con Esc y con el fondo, y el foco vuelve al botón", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    const api = await preparar(page);
    await page.goto("/catalogo");
    await expect(page.getByRole("heading", { name: "Producto 1", exact: true })).toBeVisible();

    const boton = page.getByRole("button", { name: "Categorías", exact: true });
    await boton.click();
    const dialogo = page.getByRole("dialog", { name: "Categorías" });
    await expect(dialogo).toBeVisible();
    await expect(boton).toHaveAttribute("aria-expanded", "true");
    await dialogo.getByRole("combobox", { name: "Puesto" }).selectOption(PUESTOS[1]!.id);
    await expect.poll(() => api.consultas.at(-1)?.get("puestoId")).toBe(PUESTOS[1]!.id);
    await expect(dialogo).toBeVisible(); // elegir puesto no cierra el panel
    await page.keyboard.press("Escape");
    await expect(dialogo).toBeHidden();
    await expect(boton).toBeFocused();
    await expect(page.getByRole("list", { name: "Filtros activos" })).toContainText("Puesto B-03");

    await boton.click();
    await expect(dialogo).toBeVisible();
    await page.mouse.click(350, 400); // fondo, fuera del panel (≤ 86 vw)
    await expect(dialogo).toBeHidden();
    await expect(boton).toBeFocused();
    expect(await sinDesborde(page)).toBe(true);
  });

  test("al pasar a escritorio con el panel abierto, se cierra y aparece la barra lateral", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await preparar(page);
    await page.goto("/catalogo");
    await page.getByRole("button", { name: "Categorías", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Categorías" })).toBeVisible();
    expect(await sinDesborde(page)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole("dialog", { name: "Categorías" })).toBeHidden();
    await expect(panelLateral(page)).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Buscar productos" })).toBeEditable(); // la página no quedó bloqueada
  });
});

test.describe("Catálogo · errores diferenciados (CA-CAT-08)", () => {
  for (const [modo, titulo] of [
    ["html404", "El catálogo no está disponible en este momento"],
    ["sin-conexion", "No pudimos conectar con el mercado"],
    ["error500", "El catálogo tuvo un problema al cargar"],
  ] as const) {
    test(`${modo}: mensaje propio, nunca «Error inesperado.», y «Reintentar» recupera el catálogo`, async ({ page }) => {
      const api = await preparar(page);
      api.modo = modo;
      await page.goto("/catalogo");
      // Solo las alertas de la página: Next.js añade su propio anunciador de rutas (role="alert") fuera de <main>.
      const alerta = page.getByRole("main").getByRole("alert");
      await expect(alerta.getByRole("heading", { name: titulo })).toBeVisible();
      await expect(page.getByText(/inesperado/i)).toHaveCount(0);
      api.modo = "ok";
      await alerta.getByRole("button", { name: "Reintentar" }).click();
      await expect(page.getByRole("heading", { name: "Producto 1", exact: true })).toBeVisible();
      await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    });
  }
});
