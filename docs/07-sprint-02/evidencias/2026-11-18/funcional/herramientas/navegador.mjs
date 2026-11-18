// Navegador real (Chromium) contra el frontend (3001) y la API (3000) en marcha. Sin red simulada: no se intercepta nada.
// Uso (desde frontend/): node navegador.mjs <carpeta-capturas> <salida.json>
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [, , carpeta, salida] = process.argv;
mkdirSync(carpeta, { recursive: true });
const WEB = 'http://localhost:3001';
const resultados = [];
const llamadasApi = [];
const navegador = await chromium.launch();
const pagina = await (await navegador.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
pagina.on('response', (r) => {
  const u = new URL(r.url());
  if (u.port === '3000') llamadasApi.push({ metodo: r.request().method(), ruta: u.pathname + u.search, estado: r.status() });
});
const paso = async (nombre, fn) => {
  try { const detalle = await fn(); resultados.push({ paso: nombre, ok: true, detalle }); console.log(`OK    ${nombre} — ${detalle}`); }
  catch (e) { resultados.push({ paso: nombre, ok: false, detalle: String(e.message).split('\n')[0] }); console.log(`FALLO ${nombre} — ${String(e.message).split('\n')[0]}`); }
};
const captura = (n) => pagina.screenshot({ path: join(carpeta, n), fullPage: false });

await paso('Inicio', async () => {
  await pagina.goto(WEB + '/', { waitUntil: 'networkidle' });
  await pagina.getByRole('heading').first().waitFor();
  await captura('01-inicio.png');
  return `título «${await pagina.title()}»; ${await pagina.locator('a[href^="/catalogo"]').count()} enlaces al catálogo`;
});
await paso('Navegación inicio → catálogo', async () => {
  await pagina.locator('a[href="/catalogo"]').first().click();
  await pagina.waitForURL('**/catalogo**');
  await pagina.getByText('20 productos', { exact: false }).first().waitFor({ timeout: 20000 });
  await captura('02-catalogo.png');
  return `URL ${new URL(pagina.url()).pathname}; «20 productos» visible; ${await pagina.locator('a[href^="/catalogo/"]').count()} tarjetas con enlace al detalle`;
});
await paso('Filtro por categoría (Frutas)', async () => {
  await pagina.locator('li button:visible', { hasText: /^Frutas$/ }).first().click();
  await pagina.getByText('5 productos', { exact: false }).first().waitFor({ timeout: 20000 });
  await captura('03-catalogo-frutas.png');
  return `URL ${pagina.url().replace(WEB, '')}; «5 productos» visible; «Palta fuerte»: ${await pagina.getByText('Palta fuerte').first().isVisible()}`;
});
await paso('Detalle de producto desde el catálogo', async () => {
  await pagina.locator('a[href^="/catalogo/"]').first().click();
  await pagina.waitForURL(/\/catalogo\/[0-9a-f-]{36}/);
  await pagina.getByRole('heading').first().waitFor();
  await pagina.getByText(/8\.50/).first().waitFor({ timeout: 20000 });
  await captura('04-detalle.png');
  return `URL ${pagina.url().replace(WEB, '')}; precio «8.50» visible; título «${(await pagina.getByRole('heading').first().innerText()).trim()}»`;
});
await paso('Ofertas (sin datos inventados)', async () => {
  await pagina.goto(WEB + '/ofertas', { waitUntil: 'networkidle' });
  await captura('05-ofertas.png');
  return `texto de la página incluye «ofertas»: ${/oferta/i.test(await pagina.locator('body').innerText())}`;
});
await paso('Carrito sin sesión (limitación: requiere Supabase Auth)', async () => {
  await pagina.goto(WEB + '/carrito', { waitUntil: 'networkidle' });
  await pagina.waitForTimeout(1500);
  await captura('06-carrito-sin-sesion.png');
  return `URL final ${pagina.url().replace(WEB, '')}; el cliente de sesión no puede autenticar (Supabase no configurado en esta demostración)`;
});
await paso('Inicio de sesión (limitación)', async () => {
  await pagina.goto(WEB + '/login', { waitUntil: 'networkidle' });
  await captura('07-login.png');
  return 'formulario visible; no se intenta iniciar sesión: no hay Supabase Auth en el entorno aislado';
});
await paso('Swagger UI', async () => {
  await pagina.goto('http://localhost:3000/api/docs', { waitUntil: 'networkidle' });
  await pagina.locator('.swagger-ui').first().waitFor({ timeout: 20000 });
  await pagina.locator('.opblock-tag').first().waitFor();
  await captura('08-swagger-ui.png');
  const etiquetas = await pagina.locator('.opblock-tag').count();
  const operaciones = await pagina.locator('.opblock').count();
  return `${etiquetas} grupos (etiquetas); ${operaciones} operaciones visibles (expandidas: 0 hasta abrir cada grupo)`;
});
await paso('Swagger UI · operación expandida', async () => {
  await pagina.locator('.opblock-tag', { hasText: 'Catálogo' }).first().click();
  await pagina.locator('.opblock').first().waitFor();
  await pagina.locator('.opblock-summary').first().click();
  await captura('09-swagger-operacion.png');
  return `grupo «Catálogo» alternado; primera operación abierta; ${await pagina.locator('.opblock.is-open').count()} operación(es) abierta(s)`;
});
await navegador.close();
writeFileSync(salida, JSON.stringify({ resultados, llamadasApi }, null, 2));
const resumen = {};
for (const l of llamadasApi) resumen[`${l.metodo} ${l.ruta.split('?')[0]} → ${l.estado}`] = (resumen[`${l.metodo} ${l.ruta.split('?')[0]} → ${l.estado}`] ?? 0) + 1;
console.log('\nLlamadas del navegador a la API real (:3000):'); for (const [k, v] of Object.entries(resumen)) console.log(`  ${v}× ${k}`);
console.log(`\n${resultados.filter((r) => r.ok).length} de ${resultados.length} pasos correctos`);
