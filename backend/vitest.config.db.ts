import { defineConfig } from 'vitest/config';

// Pruebas contra la base de desarrollo (restricciones del modelo). Todo se revierte en transacciones.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.db-spec.ts'],
    fileParallelism: false,
  },
});
