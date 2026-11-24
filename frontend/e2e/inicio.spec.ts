/**
 * Prueba de navegador del inicio, ofertas y navegación móvil (spec 004, E4: CA-UI-02 a CA-UI-05, CA-UI-08, CA-UI-10) con
 * RED SIMULADA: Chromium y Next.js reales; la API responde con datos que existen solo en esta prueba.
 */
import { type Page, type Route, expect, test } from "@playwright/test";

const API = "http://localhost:3999";
const CORS = { "access-control-allow-origin": "http://localhost:3210", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,OPTIONS" };
const uuid = (p: string, n: number) => `${p}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CATEGORIAS = [
  { id: uuid("c0000001", 1), nombre: "Frutas", slug: "frutas", descripcion: null, activa: true },
  { id: uuid("c0000002", 2), nombre: "Verduras", slug: "verduras", descripcion: null, activa: true },
  { id: uuid("c0000003", 3), nombre: "Pescados y mariscos", slug: "pescados-y-mariscos", descripcion: null, activa: true },
];
const PUESTOS = [
  { id: uuid("a0000001", 1), codigo: "A-12", nombre: "Puesto Uno" },
  { id: uuid("a0000002", 2), codigo: "B-03", nombre: "Puesto Dos" },
];
const PRODUCTOS = Array.from({ length: 10 }, (_, i) => ({
  id: uuid("b0000000", i + 1),
  nombre: `Producto ${i + 1}`,
  descripcion: null,
  precio: `${10 - i}.50`,
  unidadVenta: "KILOGRAMO",
  presentacion: null,
  categoria: CATEGORIAS[i % 2]!,
  puesto: PUESTOS[i % 2]!,
  imagenes: [],
}));

async function preparar(page: Page) {
  const consultas: URLSearchParams[] = [];
  await page.route("http://localhost:54321/**", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }));
  await page.route(`${API}/**`, (route: Route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    const json = (cuerpo: unknown) => route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
    if (url.pathname === "/api/v1/categorias") return json(CATEGORIAS);
    if (url.pathname === "/api/v1/puestos/publicos") return json(PUESTOS);
    if (url.pathname === "/api/v1/catalogo/productos") {
      const s = url.searchParams;
      consultas.push(s);
      const q = s.get("q")?.toLowerCase();
      let lista = PRODUCTOS.filter((p) => (!q || p.nombre.toLowerCase().includes(q)) && (!s.get("categoriaId") || p.categoria.id === s.get("categoriaId")));
      if (s.get("orden") === "precio_asc") lista = [...lista].sort((a, b) => Number(a.precio) - Number(b.precio));
      const limite = Number(s.get("limite") ?? 24);
      return json({ datos: lista.slice(0, limite), pagina: 1, limite, total: lista.length, totalPaginas: 1 });
    }
    return route.fulfill({ status: 404, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ mensaje: "Ruta no simulada." }) });
  });
  return consultas;
}

const sinDesborde = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const seccion = (page: Page, nombre: string) => page.getByRole("region", { name: nombre });

test.describe("Inicio · datos reales de la API (CA-UI-04, CA-UI-05)", () => {
  test("escritorio: hero, categorías, novedades, precios más bajos, puestos y franja con datos de la API", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const consultas = await preparar(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Compra productos frescos del mercado");
    await expect(page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("navigation", { name: "Accesos rápidos" })).toBeHidden(); // solo en móvil

    const categorias = page.getByRole("navigation", { name: "Categorías del mercado" });
    await expect(categorias.getByRole("link")).toHaveText(["Todos", "Frutas", "Verduras", "Pescados y mariscos"]);
    await expect(seccion(page, "Novedades del mercado").getByRole("article")).toHaveCount(8);
    await expect(seccion(page, "Precios más bajos").getByRole("heading", { level: 3 })).toHaveText(["Producto 10", "Producto 9", "Producto 8", "Producto 7"]);
    await expect(seccion(page, "Compra por puesto").getByRole("link")).toHaveCount(2);
    await expect(seccion(page, "Un solo carrito, varios puestos")).toContainText("2puestos");
    await expect(page.getByRole("complementary", { name: "El mercado hoy" })).toContainText("10productos publicados");

    const ordenes = consultas.map((s) => `${s.get("orden")}:${s.get("limite")}`);
    expect(ordenes).toContain("recientes:8");
    expect(ordenes).toContain("precio_asc:4");
    await expect(page.getByText(/%|descuento|más vendido|★/i)).toHaveCount(0);
    expect(await sinDesborde(page)).toBe(true);
  });

  test("el buscador lleva al catálogo con la búsqueda aplicada", async ({ page }) => {
    const consultas = await preparar(page);
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Buscar productos" }).fill("producto 3");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page).toHaveURL(/\/catalogo\?q=producto(\+|%20)3$/);
    await expect(page.getByRole("heading", { level: 2, name: "Resultados para «producto 3»" })).toBeVisible();
    await expect.poll(() => consultas.at(-1)?.get("q")).toBe("producto 3");
  });

  test("una categoría visual lleva al catálogo filtrado y la marca como activa", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await preparar(page);
    await page.goto("/");
    await page.getByRole("navigation", { name: "Categorías del mercado" }).getByRole("link", { name: "Verduras" }).click();
    await expect(page).toHaveURL(new RegExp(`/catalogo\\?categoriaId=${CATEGORIAS[1]!.id}$`));
    await expect(page.getByRole("heading", { level: 2, name: "Verduras" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Categorías" }).getByRole("button", { name: "Verduras" })).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("Navegación móvil y adaptabilidad (CA-UI-03, CA-UI-10)", () => {
  test("móvil: barra inferior del visitante, página actual marcada y sin tapar el contenido", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await preparar(page);
    await page.goto("/");
    const barra = page.getByRole("navigation", { name: "Accesos rápidos" });
    await expect(barra).toBeVisible();
    await expect(barra.getByRole("link")).toHaveText(["Inicio", "Catálogo", "Ofertas", "Ingresar"]);
    await expect(barra.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("navigation", { name: "Principal" })).toBeHidden();
    await expect(page.getByRole("link", { name: "Carrito", exact: true })).toHaveCount(0); // CA-F12

    // El último contenido queda por encima de la barra
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const cta = page.getByRole("link", { name: /Empezar a comprar/ });
    await expect(cta).toBeVisible();
    const [cajaCta, cajaBarra] = await Promise.all([cta.boundingBox(), barra.boundingBox()]);
    expect(cajaCta!.y + cajaCta!.height).toBeLessThanOrEqual(cajaBarra!.y);

    await barra.getByRole("link", { name: "Ofertas" }).click();
    await expect(page).toHaveURL(/\/ofertas$/);
    await expect(barra.getByRole("link", { name: "Ofertas" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Aún no hay ofertas publicadas" })).toBeVisible();
    await expect(seccion(page, "Precios más bajos").getByRole("heading", { level: 3 }).first()).toHaveText("Producto 10");
  });

  for (const [ancho, alto] of [
    [360, 780],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1280, 800],
  ] as const) {
    test(`sin desplazamiento horizontal a ${ancho} px en inicio, catálogo y ofertas`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: alto });
      await preparar(page);
      for (const ruta of ["/", "/catalogo", "/ofertas"]) {
        await page.goto(ruta);
        await expect(page.getByRole("article").first()).toBeVisible();
        expect(await sinDesborde(page), `${ruta} a ${ancho} px`).toBe(true);
      }
    });
  }
});
