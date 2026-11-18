import type { CoverageV8Options } from 'vitest/node';

/**
 * DEFINICIÓN ÚNICA de la cobertura del backend (spec 006, D5 y D6). La importan `vitest.config.ts` (unitarias) y
 * `vitest.config.e2e.ts` (HTTP), de modo que toda ejecución con `--coverage` mide exactamente los mismos archivos.
 *
 * - Se mide el código del sistema: `src/**`.
 * - Se excluye lo que no es del sistema: el cliente generado por Prisma, los archivos de prueba y los dobles de prueba.
 * - NO se excluyen `main.ts`, los `*.module.ts` ni los repositorios Prisma: cuentan aunque bajen la cifra.
 *
 * La cobertura se activa con `--coverage`; los directorios de salida y los umbrales los fijan los scripts
 * (`npm run test:cov` y `npm run test:cov:todo`).
 */
export const cobertura: CoverageV8Options = {
  provider: 'v8',
  include: ['src/**'],
  exclude: ['**/node_modules/**', 'src/generated/**', '**/*.spec.ts', '**/*.e2e-spec.ts', '**/*.db-spec.ts', '**/test-doubles.ts', '**/*.d.ts'],
  reporter: ['text', 'html', 'lcov', 'json-summary'],
};
