import { defineConfig } from 'vitest/config';
import { cobertura } from './vitest.cobertura.js';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    coverage: cobertura,
    include: ['**/*.spec.ts'],
  },
});
