# Plan de implementación: Documentación OpenAPI/Swagger

**Rama**: `feat/sprint02-validacion` · **Spec**: [spec.md](spec.md) · **Base**: `origin/main` `59826e7`

**Trazabilidad**: Sprint 02 IS-488 (entregable 3) · constitución II, V, IX, X · AC04, AC05

## Constitution Check

| Principio | Cumple | Cómo |
|---|---|---|
| I Monolito modular | Sí | Sin módulos ni dependencias entre módulos nuevas; `shared/http/openapi/` no importa `modules/` |
| II Clean Architecture | Sí | Controladores, casos de uso y dominio **sin cambios**; Swagger solo en la capa de entrada compartida (`shared/http`) |
| V Autenticación | Sí | No se altera el guard; la seguridad documentada se compara con `@Public()` |
| IX Calidad | Sí | Pruebas unitarias, HTTP y de exportación; sin base de datos ni Supabase |
| X Trazabilidad | Sí | CA-OAS-01…11 con prueba asignada |

## Contexto técnico

NestJS 12.3.3 · `@nestjs/swagger` **12.1.2** (peer `@nestjs/core ^12`; `class-validator`/`class-transformer` opcionales y no se instalan) · TypeScript estricto, ESM (`.js` en importaciones) · Vitest 4 · Node 24. Dependencias de desarrollo: `@apidevtools/swagger-parser` 13 y `openapi-types` (validación). Sin cambios en Prisma ni en migraciones.

## Estructura

| Archivo | Responsabilidad |
|---|---|
| `backend/src/shared/http/openapi/esquemas.ts` | Esquemas reutilizables (`components.schemas`): `Error`, `ErrorNest`, entidades, vistas y paginación |
| `backend/src/shared/http/openapi/operaciones.ts` | Catálogo declarativo de las 42 operaciones (datos, sin lógica) |
| `backend/src/shared/http/openapi/documento.ts` | `construirDocumentoOpenApi()`: función pura que ensambla `OpenAPIObject` desde el catálogo |
| `backend/src/shared/http/openapi/montar.ts` | `montarDocumentacionOpenApi(app)`: `SwaggerModule.setup('api/docs', app, documento, { jsonDocumentUrl: 'api/docs-json' })`; respeta `OPENAPI_HABILITADO=false` |
| `backend/src/shared/http/openapi/documento.spec.ts` | Pruebas del documento (validez, cuerpos, respuestas, sin secretos, igualdad con el archivo versionado) |
| `backend/test/openapi.e2e-spec.ts` | Pruebas contra la aplicación real en memoria: servidas sin sesión, rutas, seguridad, parámetros |
| `backend/scripts/exportar-openapi.mjs` | Escribe `backend/openapi/openapi.json` desde `dist/`; sin base de datos |
| `backend/openapi/openapi.json` | Documento exportado y versionado |
| `backend/src/main.ts` | Una línea: `montarDocumentacionOpenApi(app)` |
| `backend/package.json` | `@nestjs/swagger`; scripts `openapi:exportar` y `openapi:verificar`; dependencias de desarrollo |

## Verificación anti-desactualización

1. **Rutas:** `SwaggerModule.createDocument` sobre la aplicación real enumera las rutas reales (método y ruta, parámetros de ruta y de consulta); la prueba exige igualdad bidireccional con el catálogo. Una ruta nueva sin documentar, o una documentada que ya no existe, rompe CI.
2. **Seguridad:** el metadato `esPublica` (`Reflector`) de cada handler se compara con la presencia de `security`.
3. **Archivo versionado:** `openapi.json` debe ser idéntico a `construirDocumentoOpenApi()`; si se cambia el catálogo sin regenerarlo, falla.
4. **Validez:** `SwaggerParser.validate` en cada ejecución de `npm test`.
5. CI ya ejecuta `npm test` y `npm run test:e2e`: no hace falta un paso nuevo.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Cuerpos y respuestas descritos a mano pueden divergir del caso de uso | §6 de la spec lo declara; las pruebas fijan rutas, seguridad y parámetros, no esquemas de cuerpo |
| `SwaggerModule.setup` registra rutas fuera del guard | Se prueba que `/api/docs` y `/api/docs-json` responden sin sesión y que el resto sigue exigiéndola |
| Conflicto con la rama de Pedidos (`main.ts`, `package.json`) | Cambios mínimos y localizados; Pedidos no define rutas HTTP aún |
| Exposición en producción | Variable `OPENAPI_HABILITADO=false`; decisión de despliegue en Sprint 03 |
