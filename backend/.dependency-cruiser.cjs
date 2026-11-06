/**
 * Reglas de arquitectura (EQ-07 · AC05). Ejecutar: npm run arquitectura
 * - Todas las reglas son «error». Un módulo solo usa a otro por su `index.ts` (API pública) o su `*.module.ts`.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'limites-entre-modulos',
      comment: 'Un módulo solo usa a otro por su API pública (index.ts) o su *.module.ts de composición, nunca por archivos internos.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/[^/]+/', pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/(index\\.ts|[^/]+\\.module\\.ts)$'] },
    },
    {
      name: 'sin-framework-en-el-nucleo',
      comment: 'domain/ y application/ no importan NestJS, Prisma, pg ni jose (ADR-002).',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/(domain|application)/', pathNot: '\\.spec\\.ts$' },
      to: { path: ['^node_modules/(@nestjs|@prisma|pg|jose)/', '^src/generated/prisma'] },
    },
    {
      name: 'sdk-mercadopago-solo-en-su-adaptador',
      comment: 'Solo el adaptador de pasarela del módulo payments puede importar el SDK de Mercado Pago (EQ-07).',
      severity: 'error',
      from: { pathNot: '^src/modules/payments/infrastructure/' },
      to: { path: '^node_modules/mercadopago/' },
    },
    { name: 'sin-ciclos', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['\\.spec\\.ts$', '^src/generated/'] },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    reporterOptions: { text: { highlightFocused: true } },
  },
};

