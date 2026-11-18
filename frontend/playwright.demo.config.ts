import { defineConfig, devices } from "@playwright/test";

/**
 * Verificación del catálogo con la API REAL de demostración (spec 004, E2; CA-DEMO-08). Sin red simulada.
 * Requisitos: base `mercado_dev` sembrada y la API de demostración en marcha (en backend/:
 * `npm run demo:api -- --puerto 3100 --frontend http://localhost:3210`).
 * Uso: `npx playwright test -c playwright.demo.config.ts` (DEMO_API_URL, por defecto http://localhost:3100).
 *
 * Compila y sirve una versión de producción en el puerto 3210 (`next build` usa `.next`, separado del `.next/dev` de un
 * `next dev` en curso). No usa la configuración de las pruebas con red simulada (playwright.config.ts).
 */
const PUERTO = 3210;
export const DEMO_API_URL = process.env.DEMO_API_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "./e2e-demo",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "./test-results/demo",
  use: { baseURL: `http://localhost:${PUERTO}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next build && npx next start --port ${PUERTO}`,
    url: `http://localhost:${PUERTO}/catalogo`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: { NEXT_PUBLIC_API_URL: DEMO_API_URL },
  },
});
