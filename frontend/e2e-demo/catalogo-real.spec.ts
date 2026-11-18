/**
 * Catálogo REAL con la base de demostración `mercado_dev` (spec 004, E2 y E3; CA-DEMO-08, CA-IMG-08). Sin red simulada:
 * Chromium, la aplicación Next.js compilada y la API NestJS reales. Los datos esperados son los del seed de demostración
 * (backend/scripts/demo/datos-demo.mjs); no existen en el código del frontend. La API debe iniciarse con las imágenes en
 * el origen de esta prueba (`npm run demo:api -- --puerto 3100 --frontend http://localhost:3210`).
 */
import { expect, test } from "@playwright/test";

const API = process.env.DEMO_API_URL ?? "http://localhost:3100";
const CATEGORIAS = ["Frutas", "Verduras", "Tubérculos", "Menestras y granos", "Abarrotes", "Lácteos y huevos", "Carnes y aves", "Pescados y mariscos"];

test("el catálogo muestra los 20 productos y las 8 categorías de mercado_dev, y filtra con la API real", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const consultas: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/v1/")) consultas.push(r.url());
  });

  await page.goto("/catalogo");
  await expect(page.getByText("20 productos")).toBeVisible();
  // Todas las llamadas a la API van a la API de demostración
  expect(consultas.length).toBeGreaterThan(0);
  for (const u of consultas) expect(u.startsWith(API)).toBe(true);

  const panel = page.getByRole("complementary", { name: "Categorías" });
  for (const nombre of CATEGORIAS) await expect(panel.getByRole("button", { name: nombre, exact: true })).toBeVisible();
  await expect(panel.getByRole("button")).toHaveCount(CATEGORIAS.length + 1); // + «Todos»
  await expect(panel.getByRole("combobox", { name: "Puesto" }).getByRole("option")).toHaveCount(5); // «Todos los puestos» + 4

  // Tarjeta: precio en soles, unidad y puesto tal como llegan de la API
  const palta = page.getByRole("link").filter({ has: page.getByRole("heading", { name: "Palta fuerte" }) });
  await expect(palta).toContainText("S/ 8.50");
  await expect(palta).toContainText("/ kg");
  await expect(palta).toContainText("Puesto DEMO-A1 · Frutería La Cosecha");

  // Fotografías (spec §9; CA-IMG-08): lo que diga la API real. Con imagen → URL local en /demo/productos/, HTTP 200
  // image/webp y pintada; sin imagen → «Sin imagen». Nada se decide por el nombre del producto.
  const origen = new URL(page.url()).origin;
  const catalogo = (await (await page.request.get(`${API}/api/v1/catalogo/productos?pagina=1&limite=24`)).json()) as {
    datos: { nombre: string; imagenes: { url: string | null; textoAlternativo: string | null }[] }[];
  };
  let conFoto = 0;
  for (const p of catalogo.datos) {
    const tarjeta = page.getByRole("link").filter({ has: page.getByRole("heading", { name: p.nombre, exact: true }) });
    await tarjeta.scrollIntoViewIfNeeded();
    const foto = p.imagenes[0];
    if (!foto?.url) {
      await expect(tarjeta.getByRole("img", { name: "Sin imagen" })).toBeVisible();
      continue;
    }
    conFoto++;
    expect(foto.url.startsWith(`${origen}/demo/productos/`)).toBe(true);
    expect(foto.url).not.toContain("/storage/v1/object/public/");
    const respuesta = await page.request.get(foto.url);
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()["content-type"]).toContain("image/webp");
    const img = tarjeta.getByRole("img", { name: foto.textoAlternativo ?? p.nombre });
    await expect(img).toHaveAttribute("src", foto.url);
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
  console.log(`Fotografías: ${conFoto} pintadas, ${catalogo.datos.length - conFoto} con «Sin imagen».`);
  await page.evaluate(() => window.scrollTo(0, 0));

  // Categoría desde la barra lateral
  await panel.getByRole("button", { name: "Frutas", exact: true }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Frutas" })).toBeVisible();
  await expect(page.getByText("5 productos")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Frutas", exact: true })).toHaveAttribute("aria-pressed", "true");

  // «Todos» y búsqueda
  await panel.getByRole("button", { name: "Todos" }).click();
  await expect(page.getByText("20 productos")).toBeVisible();
  await page.getByRole("searchbox", { name: "Buscar productos" }).fill("papa");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText("1 producto", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Papa amarilla" })).toBeVisible();

  // Detalle del producto con datos reales
  await page.getByRole("heading", { name: "Papa amarilla" }).click();
  await expect(page).toHaveURL(/\/catalogo\/d3e00005-/);
  await expect(page.getByText("S/ 3.80").first()).toBeVisible();
  await expect(page.getByText(/DEMO-B2/).first()).toBeVisible();

  await page.goBack();
  await page.getByRole("searchbox", { name: "Buscar productos" }).fill("");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText("20 productos")).toBeVisible();
  await page.screenshot({ path: "test-results/demo/catalogo-real.png" });
});
