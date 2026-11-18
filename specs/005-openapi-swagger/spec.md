# Especificación: Documentación OpenAPI/Swagger de la API REST (Sprint 02 · IS-488)

Derivada de la API ya integrada en `main` (`59826e7`). **No crea endpoints, no cambia contratos, validaciones, reglas de negocio ni la arquitectura.** Documenta lo que existe y añade una prueba que impide que la documentación se desactualice.

## 1. Origen y alcance

- **Origen:** entregable oficial del Sprint 02, «Implementación y validación de la arquitectura de software»: *endpoints REST documentados mediante OpenAPI/Swagger*. La auditoría del 2026-11-18 sobre `59826e7` comprobó que no existía `@nestjs/swagger`, configuración ni documento (todas las URL de documentación respondían 404).
- **Tipo:** documentación ejecutable de la capa de entrada. Código nuevo solo en `backend/src/shared/http/openapi/`, una llamada en `main.ts` y herramientas fuera de `src/`.
- **Trazabilidad:** constitución II (los controladores solo traducen HTTP ↔ casos de uso; no se les añade nada) y V (rutas privadas por defecto; las públicas se marcan con `@Public()`); AC05 (mantenibilidad: la regla de dependencias no cambia); AC04 (la documentación refleja, sin sustituirla, la autorización real); RF y HU de cada módulo documentado (véase §3).

| Dentro | Fuera (declarado) |
|---|---|
| Swagger UI en `/api/docs` y documento JSON en `/api/docs-json` | Endpoints nuevos, DTO con `class-validator`, pipes o cualquier cambio de validación |
| Las **42 rutas funcionales** existentes: `GET /` y 41 bajo `/api/v1` | Pedidos y Pagos (`orders`, `payments` no tienen rutas); la API interna `ReservarInventario` (no es HTTP) |
| Seguridad Bearer (JWT de Supabase Auth) solo en las rutas protegidas | Cliente generado, SDK o pruebas de contrato contra un servidor real |
| Parámetros de ruta y consulta, cuerpos (incluido multipart), respuestas de éxito y errores comunes | Ejemplos con datos reales, tokens o claves |
| Exportación reproducible de `openapi.json` sin base de datos | Despliegue y autenticación de la propia documentación en producción (Sprint 03) |

## 2. Decisión de diseño

**El documento se construye desde un catálogo propio, no con decoradores `@Api*` en los nueve controladores.**

| Alternativa | Veredicto |
|---|---|
| Decoradores `@ApiTags`, `@ApiBody`… en cada controlador | Descartada: toca nueve archivos de la capa de entrada, mezcla documentación con el código que traduce HTTP y no puede exportarse sin crear la aplicación (y con ella `PrismaService`, que exige `DATABASE_URL`) |
| Plugin del CLI de `@nestjs/swagger` | Descartada: infiere esquemas de clases y los cuerpos son `Record<string, unknown>` o interfaces, que no deja rastro en tiempo de ejecución |
| **Catálogo declarativo en `shared/http/openapi/` y documento propio entregado a `SwaggerModule.setup`** | **Elegida.** Los controladores no cambian; el documento se genera sin base de datos; la fidelidad se garantiza con pruebas que lo comparan con las rutas reales |

`shared/http/openapi/` **no importa ningún módulo** (la regla `limites-entre-modulos` no se ve afectada). Las pruebas, que sí importan la aplicación, viven fuera de `src/` o en `*.spec.ts` (excluidos de `dependency-cruiser`).

## 3. Rutas cubiertas (42)

| Etiqueta (módulo) | Rutas |
|---|---|
| Sistema | `GET /` (pública) |
| Autenticación | `POST /api/v1/auth/registro` (pública) · `GET /api/v1/auth/me` |
| Usuarios (5) | `POST`, `GET /api/v1/usuarios` · `GET /:id` · `PATCH /:id/estado` · `PATCH /:id/rol` |
| Comerciantes y puestos (11) | `POST`, `GET /api/v1/comerciantes` · `GET`, `PATCH /comerciantes/:id` · `PATCH /comerciantes/:id/estado` · `POST`, `GET /api/v1/puestos` · `GET /puestos/publicos` (pública) · `GET`, `PATCH /puestos/:id` · `PATCH /puestos/:id/estado` |
| Categorías (5) | `GET /api/v1/categorias` (pública) · `GET /categorias/gestion` · `POST /categorias` · `PATCH /categorias/:id` · `PATCH /categorias/:id/estado` |
| Productos (7) | `POST`, `GET /api/v1/productos` · `GET`, `PATCH /productos/:id` · `PATCH /productos/:id/estado` · `POST /productos/:id/imagenes` (multipart) · `DELETE /productos/:id/imagenes/:imagenId` |
| Catálogo público (2) | `GET /api/v1/catalogo/productos` · `GET /catalogo/productos/:id` (públicas) |
| Inventario (4) | `GET /api/v1/inventario` · `GET`, `POST /inventario/productos/:productoId/movimientos` · `GET /inventario/productos/:productoId` |
| Carrito (5) | `GET`, `DELETE /api/v1/carrito` · `POST /carrito/items` · `PATCH`, `DELETE /carrito/items/:productoId` |

Públicas (6): `GET /`, `POST /auth/registro`, `GET /catalogo/productos`, `GET /catalogo/productos/:id`, `GET /categorias`, `GET /puestos/publicos`. Protegidas (36): exigen `Authorization: Bearer <JWT de Supabase>`.

## 4. Cómo se documenta cada elemento

| Elemento | Regla |
|---|---|
| Seguridad | Esquema `bearerAuth` (`http`, `bearer`, `JWT`). Las rutas protegidas declaran `security: [{ bearerAuth: [] }]`; las públicas, `security: []`. Se compara con el metadato real `@Public()` |
| Roles | Texto informativo por operación, tomado de la matriz AC04 del 2026-11-16 (`docs/07-sprint-02/evidencias/2026-11-16/AC04/`). **La autorización real vive en los casos de uso**; la documentación no la sustituye |
| Parámetros de ruta | Siempre `required`, `type: string`, `format: uuid` cuando el controlador usa `ParseUUIDPipe` |
| Consulta | Un parámetro por cada `@Query('x')` real, `type: string` (el controlador los recibe como texto y los convierte), con su significado y su valor por defecto o límite solo si el código lo fija |
| Cuerpos `Record<string, unknown>` o interfaces | `requestBody` explícito con los campos que el controlador lee, marcando `required` los que el caso de uso exige. **No sustituye ni añade validación**; `additionalProperties` se documenta según lo que el controlador ignora |
| Multipart | `POST /productos/:id/imagenes`: `multipart/form-data` con `archivo` (`binary`, máximo 2 MiB, imagen) y `textoAlternativo` opcional |
| Éxito | Código real del controlador (`201` para `POST`; `200` para el resto) y esquema de la vista que devuelve |
| Errores | Esquema común `Error` `{ statusCode, codigo, mensaje }` (filtro `DomainErrorFilter`): 400, 401, 403, 404, 409 y 503 solo donde el código lo produce (§5). El `400` de un identificador que no es UUID lo produce `ParseUUIDPipe` con el cuerpo estándar de Nest (`{ statusCode, message, error }`) y se documenta como alternativa |
| Datos sensibles | Sin ejemplos con tokens, contraseñas ni claves. `authId` no aparece en `Usuario` (el controlador lo elimina). El documento no contiene URL de proyectos ni variables de entorno |

## 5. Criterios de aceptación

| ID | Criterio (medible) | Evidencia |
|---|---|---|
| CA-OAS-01 | `GET /api/docs` (Swagger UI) y `GET /api/docs-json` responden 200 **sin** `Authorization` y no alteran las demás rutas ni el guard | `test/openapi.e2e-spec.ts` |
| CA-OAS-02 | El documento es OpenAPI 3.x válido: `SwaggerParser.validate` termina sin errores y resuelve todas las `$ref` | `documento.spec.ts` |
| CA-OAS-03 | **Cobertura exacta:** el conjunto (método, ruta) del documento es igual al de las rutas reales de la aplicación (42), sin faltantes ni sobrantes. Las rutas de Swagger no cuentan. Se distingue `GET /` de las 41 de `/api/v1` | `openapi.e2e-spec.ts` |
| CA-OAS-04 | Una operación es pública (sin `security`) **si y solo si** su handler o su controlador tienen `@Public()`; las 36 restantes declaran `bearerAuth` | `openapi.e2e-spec.ts` |
| CA-OAS-05 | Los parámetros de ruta y de consulta de cada operación son exactamente los de su handler (`@Param` y `@Query`) | `openapi.e2e-spec.ts` |
| CA-OAS-06 | Las operaciones con cuerpo declaran `requestBody`; la de imágenes es `multipart/form-data` con `archivo` binario. Ninguna operación `GET`/`DELETE` declara cuerpo | `documento.spec.ts` |
| CA-OAS-07 | Toda operación declara el código de éxito real y el error común donde corresponde; toda ruta protegida declara 401 y 403; toda ruta con `:id` declara 404 | `documento.spec.ts` |
| CA-OAS-08 | El documento no contiene `authId`, `contrasena` como respuesta, ni cadenas que parezcan tokens, claves o URL de Supabase | `documento.spec.ts` |
| CA-OAS-09 | `npm run openapi:exportar` genera `backend/openapi/openapi.json` sin base de datos, sin Supabase y de forma idéntica en dos ejecuciones; el archivo versionado **es igual** al generado (si no, la prueba falla y pide regenerarlo) | `documento.spec.ts`; ejecución real |
| CA-OAS-10 | Sin regresiones: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build` y `npm run arquitectura` siguen en verde y no hay cambios en controladores, casos de uso ni dominio | Resultados reales; `git diff` |
| CA-OAS-11 | Las limitaciones del contrato están declaradas (§6) y la descripción del documento no afirma que sea exhaustivo | Revisión del texto |

## 6. Limitaciones declaradas (el contrato **no** es exhaustivo)

- Los esquemas de **entrada** de los cuerpos se derivan de lo que cada controlador lee y de las reglas visibles en las entidades; la validación definitiva la hacen los casos de uso y puede ser más estricta. Ninguna prueba compara los campos de un cuerpo con los del caso de uso (no hay metadatos de ejecución).
- Los esquemas de **salida** se describen a mano a partir de las entidades y vistas (`toJSON()`, `vistaProducto`, `ProductoCatalogo`, `CarritoCalculado`). No se validan contra respuestas reales de PostgreSQL; sí contra la forma que ya fijan las pruebas HTTP existentes solo de manera indirecta.
- El filtro de errores devuelve **500** (cuerpo estándar de Nest) si falla la base de datos; no existe 503 para ese caso (hueco R3 conocido) y no se documenta como si existiera. Tampoco se documentan 413/415 de la subida más allá de lo que describe el código del caso de uso.
- Los roles son los observados el 2026-11-16 (AC04); si cambia la autorización, la matriz y esta documentación deben repetirse.
- Swagger UI se sirve desde el paquete `swagger-ui-dist`; su exposición en producción y su protección se deciden en el Sprint 03. Se puede desactivar con `OPENAPI_HABILITADO=false`.

## 7. Aclaraciones

- A1 — Las rutas de Swagger (`/api/docs`, `/api/docs-json`) no son funcionales: no aparecen en el documento ni cuentan en las 42.
- A2 — El documento incluye `GET /` (raíz, «Hello World!», resto de la plantilla de Nest) porque es una ruta real; se documenta como `Sistema` sin presentarla como parte del dominio.
- A3 — `servers` apunta a `/` (relativo): no se codifican hosts ni puertos.
