/**
 * Inicio y ofertas con la API REAL de demostración (`mercado_dev`) — spec 004, E4: CA-UI-04, CA-UI-05, CA-UI-08, CA-UI-10.
 * Sin red simulada. Deja capturas de escritorio y móvil en test-results/demo/ para la revisión visual.
 */
import { expect, test } from "@playwright/test";

const API = process.env.DEMO_API_URL ?? "http://localhost:3100";

test("el inicio muestra categorías, novedades, precios más bajos, puestos y recuentos reales de mercado_dev", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const [categorias, puestos, novedades, economicos] = await Promise.all([
    page.request.get(`${API}/api/v1/categorias`).then((r) => r.json()),
    page.request.get(`${API}/api/v1/puestos/publicos`).then((r) => r.json()),
    page.request.get(`${API}/api/v1/catalogo/productos?pagina=1&limite=8&orden=recientes`).then((r) => r.json()),
    page.request.get(`${API}/api/v1/catalogo/productos?pagina=1&limite=4&orden=precio_asc`).then((r) => r.json()),
  ]);

  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Categorías del mercado" });
  await expect(nav.getByRole("link")).toHaveText(["Todos", ...categorias.map((c: { nombre: string }) => c.nombre)]);
  const nov = page.getByRole("region", { name: "Novedades del mercado" });
  await expect(nov.getByRole("heading", { level: 3 })).toHaveText(novedades.datos.map((p: { nombre: string }) => p.nombre));
  const eco = page.getByRole("region", { name: "Precios más bajos" });
  await expect(eco.getByRole("heading", { level: 3 })).toHaveText(economicos.datos.map((p: { nombre: string }) => p.nombre));
  await expect(page.getByRole("region", { name: "Compra por puesto" }).getByRole("link")).toHaveCount(puestos.length);
  const resumen = page.getByRole("complementary", { name: "El mercado hoy" });
  await expect(resumen).toContainText(`${novedades.total}productos publicados`);
  await expect(resumen).toContainText(`${puestos.length}puestos vendiendo`);
  await expect(resumen).toContainText(`${categorias.length}categorías`);
  await expect(page.getByText(/%|descuento|más vendido|★/i)).toHaveCount(0);
  await page.screenshot({ path: "test-results/demo/inicio-escritorio.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(nov.getByRole("heading", { level: 3 }).first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Accesos rápidos" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/demo/inicio-movil.png" });
  await page.getByRole("region", { name: "Mensajes del mercado" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/demo/inicio-movil-banner.png" });

  await page.goto("/ofertas");
  await expect(page.getByRole("heading", { name: "Aún no hay ofertas publicadas" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Precios más bajos" }).getByRole("heading", { level: 3 }).first()).toHaveText(economicos.datos[0].nombre);
  await page.screenshot({ path: "test-results/demo/ofertas-movil.png" });

  await page.goto("/catalogo");
  await expect(page.getByText(`${novedades.total} productos`)).toBeVisible();
  await page.screenshot({ path: "test-results/demo/catalogo-movil.png" });
});
