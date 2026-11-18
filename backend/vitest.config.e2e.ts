import { defineConfig } from 'vitest/config';
import { cobertura } from './vitest.cobertura.js';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    coverage: cobertura,
    include: ['**/*.e2e-spec.ts'],
  },
});
