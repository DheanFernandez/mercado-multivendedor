/**
 * Jest 30 como ejecutor ADICIONAL (spec 006). Vitest sigue siendo el ejecutor principal del backend.
 * Solo recoge `test/jest/**\/*.jest-spec.ts`; Vitest no recoge esos archivos y Jest no recoge los de Vitest.
 * ESM nativo: se ejecuta con `node --experimental-vm-modules` (véase `npm run test:jest`).
 *
 * COBERTURA PARCIAL: el informe de Jest (`coverage/jest/`) mide únicamente los módulos que esta suite ejercita
 * (dominio y casos de uso de carrito, inventario y catálogo). NO es la cobertura del backend; la global es
 * `npm run test:cov:todo` (`coverage/global/`).
 */
export default {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/jest/**/*.jest-spec.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  // El código fuente importa con extensión `.js` (nodenext): se resuelve al `.ts` correspondiente.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: { '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/tsconfig.json' }] },
  coverageProvider: 'v8',
  coverageDirectory: '<rootDir>/coverage/jest',
  coverageReporters: ['text', 'text-summary', 'html', 'lcov', 'json-summary'],
  collectCoverageFrom: [
    'src/modules/cart/{domain,application}/**/*.ts',
    'src/modules/inventory/{domain,application}/**/*.ts',
    'src/modules/catalog/application/**/*.ts',
    '!**/*.spec.ts',
    '!**/test-doubles.ts',
    '!**/*.d.ts',
  ],
};
