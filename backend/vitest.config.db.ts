import { defineConfig } from 'vitest/config';
import { urlDePruebas } from './scripts/base-aislada.mjs';

// Pruebas de integración y de base de datos. SOLO se ejecutan contra la base local de Docker (mercado_test):
// `urlDePruebas()` lanza un error —y Vitest no arranca— si TEST_DATABASE_URL apunta a Supabase, Neon u otra base remota.
// DATABASE_URL del archivo .env (que puede ser Supabase) se IGNORA y se sustituye por la URL de pruebas.
const url = urlDePruebas();

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.db-spec.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: { DATABASE_URL: url, DIRECT_URL: url, TEST_DATABASE_URL: url },
  },
});
