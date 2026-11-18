# Tareas: Documentación OpenAPI/Swagger

Las casillas se marcan cuando la tarea está implementada **y** su prueba ha pasado. Sin commits automáticos.

## Estado de ejecución y de integración

| Parte | Tareas | Ejecutada y verificada localmente | Integrada en `main` |
|---|---|---|---|
| Documentación OpenAPI (spec 005) | T001–T012 | Sí (2026-11-18; véase «Resultados») | **No.** Rama `feat/sprint02-validacion` sobre `59826e7`, sin commits ni PR |

## Phase 1: Preparación

- [x] T001 Worktree `D:\LABO_Lizbeth\mercado-sprint02-wt`, rama `feat/sprint02-validacion` desde `origin/main` `59826e7`; `npm ci`
- [x] T002 Dependencias: `@nestjs/swagger` 12.1.2; desarrollo: `@apidevtools/swagger-parser`, `openapi-types`

## Phase 2: Pruebas primero

- [x] T003 [P] `documento.spec.ts` — CA-OAS-02, 06, 07, 08, 09
- [x] T004 [P] `test/openapi.e2e-spec.ts` — CA-OAS-01, 03, 04, 05

## Phase 3: Implementación

- [x] T005 `esquemas.ts` (esquemas comunes, entidades y vistas)
- [x] T006 `operaciones.ts` (42 operaciones, roles según AC04) — CA-OAS-03 a 07
- [x] T007 `documento.ts` (`construirDocumentoOpenApi`)
- [x] T008 `montar.ts` y llamada en `main.ts` — CA-OAS-01
- [x] T009 `scripts/exportar-openapi.mjs`, scripts npm y `openapi/openapi.json` — CA-OAS-09

## Phase 4: Verificación

- [x] T010 Regresión: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`, `npm run arquitectura` — CA-OAS-10
- [x] T011 Arranque real de `dist/main` con valores ficticios: `/api/docs` y `/api/docs-json` — CA-OAS-01
- [x] T012 Revisión: archivos, lockfile, secretos y estado de Git — CA-OAS-08, 10, 11

## Resultados

**Verificación del 2026-11-18** (rama `feat/sprint02-validacion` sobre `origin/main` = `59826e7`; Windows 11, Node.js 24.19.0, npm 11.17.0, NestJS 12.3.3, `@nestjs/swagger` 12.1.2; sin Supabase, sin `.env`, sin base de datos, sin migraciones y sin contenedores; para el HTTP en memoria, `DATABASE_URL` ficticia `127.0.0.1:1`):

| Verificación | Resultado |
|---|---|
| `documento.spec.ts` (CA-OAS-02, 06–09, 11) | **9 / 9**: OpenAPI 3.0.3 válido (`SwaggerParser.validate`), 42 operaciones (1 raíz + 41 bajo `/api/v1`), 6 públicas, sin datos sensibles, archivo versionado idéntico al generado |
| `test/openapi.e2e-spec.ts` (CA-OAS-01, 03–05) | **6 / 6** contra la aplicación completa: rutas reales = documentadas (42 = 42), `@Public()` real = sin `security`, parámetros de ruta y consulta y códigos de éxito iguales |
| Sensibilidad de las pruebas | Se alteró el catálogo y las pruebas fallaron: una ruta marcada pública sin serlo (CA-OAS-04), una ruta inventada (CA-OAS-03 y 05), un parámetro de consulta omitido (CA-OAS-05) y un archivo versionado desactualizado (CA-OAS-09). El catálogo se restauró |
| Backend: `npm test` | **338 / 338** (21 archivos; antes 329 / 20) |
| Backend: `npm run test:e2e` | **132 / 132** con `DATABASE_URL` ficticia (antes 126). Sin ella, 131 / 132: falla solo `app.e2e-spec.ts`, como en `main` |
| `npm run lint`, `npm run build`, `npm run arquitectura` | Correctos; **0 violaciones** (111 módulos, 375 dependencias; antes 106 / 365) |
| `npm run openapi:verificar` | El archivo versionado coincide con el generado; exportación sin base de datos |
| Arranque real de `dist/main` (puerto 3398, variables ficticias) | `/api/docs` 200 `text/html`; `/api/docs-json` 200 `application/json` e **idéntico** a `openapi/openapi.json`; los 4 recursos estáticos de Swagger UI responden 200; `GET /api/v1/carrito` sin sesión → 401 |
| `npm audit --omit=dev` | 0 vulnerabilidades. `npm audit` (con desarrollo): 18, **idéntico** a `59826e7` (sin vulnerabilidades nuevas) |

**Cobertura de rutas:** 42 de 42 (6 públicas y 36 protegidas). **Esquemas:** 20 reutilizables (`components.schemas`). El documento ocupa unos 145 KB.

**Limitaciones y riesgos:**

- El contrato **no es exhaustivo** (spec §6): los esquemas de cuerpo y de respuesta están descritos a mano y ninguna prueba los compara con el caso de uso o con respuestas reales de PostgreSQL. Solo rutas, seguridad, parámetros y códigos de éxito están garantizados contra el código.
- Los roles son los de la matriz AC04 del 2026-11-16; no se leen del código.
- Con la base caída, la API responde 500 (cuerpo estándar de Nest), no 503; no se documenta como 503.
- Swagger UI queda activa por defecto, también en producción; `OPENAPI_HABILITADO=false` la desactiva. Su exposición se decide en el Sprint 03.
- `npm run build` (`nest build`) borra `dist/`; `openapi:exportar` y `openapi:verificar` lo ejecutan.
- No se ejecutaron `test:db` (aplicaría migraciones) ni el frontend: no se tocaron. El CI del PR ejecutará `test:db`.
- Posible conflicto de fusión con la rama de Pedidos en `backend/package.json` y `backend/package-lock.json` (dependencias).
