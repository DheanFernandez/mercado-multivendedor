# Plan de implementación: Jest y cobertura

**Rama**: `test/sprint02-cobertura` · **Spec**: [spec.md](spec.md) · **Base**: `origin/main` `3bdded7`

**Trazabilidad**: Sprint 02 IS-488 (entregable 4) · constitución IX, X · RC10, EQ-07, AC05

## Constitution Check

| Principio | Cumple | Cómo |
|---|---|---|
| II Clean Architecture | Sí | Sin cambios en `src/modules`; Jest prueba dominio y aplicación, que no importan framework |
| IX Calidad | Sí | Resultados reales; lo no ejecutado se declara; sin red ni base de datos |
| X Trazabilidad | Sí | CA-COV-01…10 con evidencia asignada |

## Contexto técnico

Node 24 · TypeScript 6.0.3 (`module: nodenext`, `"type": "module"`) · Vitest 4.1.12 + `@vitest/coverage-v8` · **Jest 30.5.2**, **ts-jest 29.4.15**, `@jest/globals` 30.5.2 (desarrollo, versiones exactas) · NestJS 12 · sin cambios en Prisma.

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `backend/jest.config.mjs` | ts-jest ESM, `testMatch: **/*.jest-spec.ts`, mapeo de `.js`, cobertura propia en `coverage/jest` limitada a los módulos probados |
| `backend/test/jest/*.jest-spec.ts` (5) | Suite representativa |
| `backend/vitest.cobertura.ts` | Definición única de cobertura de Vitest |
| `backend/vitest.config.ts`, `vitest.config.e2e.ts` | Importan la definición única |
| `backend/scripts/cobertura-global.mjs` | Ejecuta unitarias y HTTP con `--reporter=blob`, las une con `--merge-reports` y aplica los umbrales |
| `backend/package.json` | Scripts `test:jest`, `test:cov` (definición única), `test:cov:todo`; dependencias de desarrollo |
| `.github/workflows/ci.yml` | Jest, cobertura combinada con artefacto, Vitest del frontend |

## Orden

1. Especificación. 2. Jest: configuración, pruebas y compatibilidad. 3. Cobertura única de Vitest y combinada; medición y umbrales. 4. CI. 5. Regresión completa. 6. Plan de commits.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| ts-jest no resuelve alguna importación ESM | `moduleNameMapper`; si falla, se registra el bloqueo concreto |
| Dos cifras de cobertura confunden al lector | Directorios y rótulos separados (`jest` parcial, `global` combinada); la spec y el informe lo explican |
| Umbrales frágiles | Margen explícito bajo el valor medido; solo en la ejecución combinada |
| CI más lento | Aceptado; la cobertura reutiliza la misma instalación |
