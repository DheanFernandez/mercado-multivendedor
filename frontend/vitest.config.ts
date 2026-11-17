import { defineConfig } from "vitest/config";

// Pruebas unitarias y de componente (spec 002-carrito, tareas T002). La prueba de navegador vive en e2e/ (Playwright).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true, // necesario para la limpieza automática de Testing Library
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
  },
});
