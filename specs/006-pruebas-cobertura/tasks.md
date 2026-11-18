# Tareas: Jest y cobertura

Las casillas se marcan cuando la tarea está implementada **y** su prueba ha pasado. Sin commits automáticos.

## Estado de ejecución y de integración

| Parte | Tareas | Ejecutada y verificada localmente | Integrada en `main` |
|---|---|---|---|
| Jest, cobertura global y CI (spec 006) | T001–T014 | Sí, salvo T011 (CI: sintaxis validada, **no ejecutado en GitHub**), T013 y T014 (véase «Resultados») | **No.** Rama `test/sprint02-cobertura` sobre `3bdded7`, sin commits ni PR |

## Phase 1: Preparación

- [x] T001 Worktree `D:\LABO_Lizbeth\mercado-cobertura-wt`, rama `test/sprint02-cobertura` desde `origin/main` `3bdded7`; `npm ci`
- [x] T002 Dependencias de desarrollo: `jest`, `ts-jest`, `@jest/globals` (versiones exactas)

## Phase 2: Jest

- [x] T003 `jest.config.mjs` (ESM, mapeo `.js`, cobertura propia) y script `test:jest` — CA-COV-01, 03
- [x] T004 [P] `stock.jest-spec.ts` y `calculo-carrito.jest-spec.ts` — CA-COV-01
- [x] T005 [P] `carrito.jest-spec.ts`, `inventario.jest-spec.ts` y `catalogo.jest-spec.ts` — CA-COV-01
- [x] T006 Evaluación de compatibilidad (decoradores de NestJS y cliente Prisma) y registro del resultado — spec §4
- [x] T007 Comprobar la separación Vitest/Jest — CA-COV-02

## Phase 3: Cobertura global de Vitest

- [x] T008 `vitest.cobertura.ts` e importación desde las dos configuraciones — CA-COV-04
- [x] T009 `scripts/cobertura-global.mjs` y scripts `test:cov` y `test:cov:todo` — CA-COV-05
- [x] T010 Medición, comparación con la línea base y umbrales — CA-COV-06, 07

## Phase 4: CI

- [ ] T011 `ci.yml`: Jest, cobertura combinada con artefacto y Vitest del frontend — CA-COV-08 *(editado y YAML validado; se marcará cuando el PR lo ejecute)*

## Phase 5: Verificación

- [x] T012 Regresión: `npm test`, `npm run test:e2e`, `npm run test:jest`, `npm run test:cov:todo`, lint, build, arquitectura, `openapi:verificar` y `npm test` del frontend — CA-COV-09
- [ ] T013 Revisión: archivos, lockfile, secretos y estado de Git — CA-COV-09, 10
- [ ] T014 Plan de commits

## Resultados

**Verificación del 2026-11-18** (rama `test/sprint02-cobertura` sobre `origin/main` = `3bdded7`; Windows 11, Node.js 24.19.0, npm 11.17.0; Jest 30.5.2, ts-jest 29.4.15, Vitest 4.1.12; sin Supabase, sin `.env`, sin base de datos, sin migraciones y sin contenedores; HTTP con `DATABASE_URL` ficticia `127.0.0.1:1`):

| Verificación | Resultado |
|---|---|
| Jest (`npm run test:jest`) | **6 suites, 88 / 88**: `stock`, `calculo-carrito`, `carrito`, `inventario`, `catalogo` y `compatibilidad` (CA-COV-01) |
| Compatibilidad (spec §4) | TypeScript 6 + ESM con importaciones `.js`: **funciona** con `moduleNameMapper`. Decoradores de NestJS (`CarritoController`): **funciona**. Cliente de Prisma generado: **carga** sin conectarse. Requiere `node --experimental-vm-modules` |
| Separación Vitest/Jest (CA-COV-02) | `npm test` **338 / 338** y `npm run test:e2e` **132 / 132**, iguales que antes: Vitest no recoge los 88 de Jest; Jest solo recoge `*.jest-spec.ts` |
| Cobertura **parcial de Jest** (`coverage/jest/`; 10 archivos de carrito, inventario y catálogo) | Sentencias **88,16 %** (596/676), ramas **94,34 %** (217/230), funciones **95,34 %** (82/86), líneas **88,16 %**. **No es la cobertura del backend** |
| Cobertura **global de Vitest** (`npm run test:cov:todo`; 470 pruebas = 338 + 132; `coverage/global/`) | Sentencias **73,52 %** (1333/1813), ramas **70,73 %** (718/1015), funciones **78,07 %** (438/561), líneas **76,01 %** (1138/1497) |
| Mismos archivos en las tres vistas (CA-COV-05) | Unitarias, HTTP y combinada miden **95 archivos** de `src/`, ninguno generado ni de prueba |
| Unitarias solas / HTTP solas (informativo) | 54,71 / 65,51 / 50,08 / 54,70 % y 63,65 / 56,74 / 70,40 / 68,00 % (sentencias / ramas / funciones / líneas) |
| Umbrales (CA-COV-06) | 70 / 67 / 75 / 73 %, bajo lo medido por 3,5 / 3,7 / 3,1 / 3,0 puntos. Un umbral de 99 % hizo fallar la ejecución («does not meet global threshold»); los reales pasan |
| `npm run lint`, `arquitectura`, `openapi:verificar` | Correctos; 0 violaciones (111 módulos, 375 dependencias); el contrato OpenAPI coincide |
| Frontend: `npm test` (Vitest) | **177 / 177** (13 archivos) |

**Comparación con la línea base del 2026-11-18** (vista D sobre `59826e7`: 74,89 / 71,36 / 80,16 / 77,08 %): la cifra actual es **1,4 / 0,6 / 2,1 / 1,1 puntos menor**. No es una regresión de las pruebas (se añadieron 88 de Jest y 9 + 6 de OpenAPI): cambia el denominador. Se excluyen los 4 dobles de prueba (`test-doubles.ts`, cubiertos al 100 %, que inflaban la cifra) y se incorporan los 4 archivos de OpenAPI de `src/shared/http/openapi/`; ambas listas tienen 95 archivos, por eso el recuento coincide. Los demás 91 archivos son los mismos. La cobertura de Jest **no** se suma a la de Vitest.

**Por qué no hay mejora de la cifra global:** las pruebas de Jest ejercitan código que Vitest ya cubría (dominio y casos de uso al 97–100 %); lo que baja la cifra son los repositorios Prisma (6–30 %), que solo ejercita `test:db`, y los 4 scripts de `src/scripts/` (0 %, ya presentes en la línea base).

**Limitaciones y riesgos:**

- La cobertura de Jest es **parcial** y no sustituye a la global; las dos cifras no son comparables.
- La cobertura global **no incluye `test:db`** (PostgreSQL), que no se ejecutó localmente; por eso los repositorios Prisma quedan bajos.
- El CI se editó pero **no se ha ejecutado**: el artefacto de cobertura, `test:jest` y el Vitest del frontend se verán al abrir el PR. Los umbrales podrían comportarse distinto en Linux si hubiera diferencias de plataforma.
- La cobertura mide líneas ejecutadas, no la calidad de las aserciones.
- Jest requiere `--experimental-vm-modules` (muestra un aviso de Node) y duplica trabajo con Vitest en CI.
- Posible conflicto de fusión con la rama de Pedidos en `backend/package.json` y `package-lock.json`.
- Sin Playwright en CI (necesita servicios que el flujo no tiene preparados).
