import { defineConfig, devices } from "@playwright/test";

// Prueba de navegador del carrito (spec 002-carrito, T003/T027) con RED SIMULADA:
// el servidor de desarrollo arranca con URLs falsas de Supabase y del backend, de modo que ninguna llamada llega a servicios reales.
const PUERTO = 3210;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PUERTO}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev --port ${PUERTO}`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "clave-publica-de-prueba",
      NEXT_PUBLIC_API_URL: "http://localhost:3999",
    },
  },
});
