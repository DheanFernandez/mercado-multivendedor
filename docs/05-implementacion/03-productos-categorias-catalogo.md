# Productos, categorías y catálogo

> Cubre RF09–RF11 (productos y categorías) y RF16–RF19 (catálogo); HU01–HU03 y HU12–HU13. Sin carrito ni pagos.

## Decisiones donde la documentación guarda silencio

| Tema | Decisión | Motivo |
|---|---|---|
| Quién gestiona las categorías | El **administrador** (crear, renombrar, activar/desactivar). El comerciante solo las elige | `01-actores.md` no asigna categorías a otro actor; son una clasificación global del mercado |
| Estructura de categorías | **Plana** (sin jerarquías); `slug` único derivado del nombre | RF10 solo pide asociar productos a categorías |
| Atribuciones del administrador sobre productos | **Solo lectura** (supervisión). No crea ni modifica | El actor Administrador no incluye gestionar productos |
| Presentaciones (HU13) | `unidadVenta` (enum: UNIDAD, KILOGRAMO, GRAMO, LITRO, DOCENA, MANOJO, PAQUETE) + texto libre `presentacion` | RF11 pide "presentaciones"; no hay catálogo cerrado |
| Estado de publicación | BORRADOR → PUBLICADO ⇄ DESACTIVADO (RF09 "desactivar"; los productos no se eliminan) | Conserva historial para pedidos futuros |
| Disponibilidad (RF19) | **No incluye stock**: pertenece al módulo Inventario (ADR-003), aún sin implementar | Evitar duplicar la fuente de verdad del stock |
| Trabajador de puesto | No gestiona productos todavía | Su modelo de permisos por puesto no existe aún |
| Moneda | Soles (PEN), `NUMERIC(10,2)`, mayor que cero. Aritmética en céntimos enteros; la API usa texto `"12.50"` | Evitar errores de coma flotante |

## Visibilidad en el catálogo público
Un producto aparece solo si: estado `PUBLICADO` **y** categoría activa **y** puesto `ACTIVO` **y** comerciante `ACTIVO`. Un producto que no cumple se trata como inexistente (404).

## Rutas HTTP
| Método y ruta | Acceso |
|---|---|
| `GET /api/v1/categorias` | Público (solo activas) |
| `GET /api/v1/categorias/gestion` | Administrador |
| `POST /api/v1/categorias`, `PATCH /api/v1/categorias/:id`, `PATCH /api/v1/categorias/:id/estado` | Administrador |
| `GET /api/v1/catalogo/productos?q&categoriaId&puestoId&precioMin&precioMax&orden&pagina&limite` | Público (límite máx. 50) |
| `GET /api/v1/catalogo/productos/:id` | Público |
| `POST /api/v1/productos` | Comerciante titular del puesto |
| `GET /api/v1/productos`, `GET /api/v1/productos/:id` | Comerciante (solo los suyos) · Administrador (todos, lectura) |
| `PATCH /api/v1/productos/:id`, `PATCH /api/v1/productos/:id/estado` | Comerciante titular |
| `POST /api/v1/productos/:id/imagenes` (multipart, campo `archivo`), `DELETE /api/v1/productos/:id/imagenes/:imagenId` | Comerciante titular |

## Imágenes (Supabase Storage)
Puerto `AlmacenArchivos` (`shared/`), adaptador `SupabaseAlmacenAdapter`. Máx. 5 por producto, JPEG/PNG/WebP, 2 MB; se valida la firma real del archivo, no solo el tipo declarado. Requiere `SUPABASE_SERVICE_ROLE_KEY` (solo backend) y un bucket **público** (`SUPABASE_STORAGE_BUCKET`, por defecto `productos`). Sin configuración, subir imágenes responde 503 y el resto del módulo funciona.

## Interfaz del catálogo público (spec 004, 2026-11-08)
Especificación: [`specs/004-catalogo-publico/`](../../specs/004-catalogo-publico/spec.md). Solo frontend; la API no cambió.

- **Carga automática:** `/catalogo` consulta la primera página (`pagina=1`, `limite=24`, `orden=recientes`) sin exigir búsqueda ni filtros.
- **Filtros opcionales:** búsqueda (se aplica al enviar), categorías en píldoras, rango de precio (atajos o libre) y puesto en un panel lateral (escritorio) o diálogo (móvil), orden; los filtros activos se muestran como etiquetas que se pueden quitar. El estado vive en la URL (`history.replaceState`), por lo que «Atrás» desde el detalle conserva la vista.
- **Tarjetas:** foto, nombre, precio y unidad tal como llegan de la API, categoría, puesto y presentación o extracto. Sin disponibilidad (RF19 depende de Inventario).
- **Estados:** esqueleto de carga, catálogo vacío («Todavía no hay productos publicados»), sin resultados y errores diferenciados con «Reintentar» (sin conexión, respuesta que no es de la API, error del servidor, filtro no válido).
- **Cliente HTTP:** `ErrorApi` incluye `codigo` (`SIN_CONEXION`, `RESPUESTA_NO_API`, `ERROR_SERVIDOR` o el del backend); una respuesta que no es JSON ya no se muestra como «Error inesperado.».
- **Causa del incidente del 2026-11-07:** el frontend se inició con `next dev` en el puerto 3000 (el de la API); la API no pudo escuchar y las peticiones llegaban a Next.js (404 HTML). El script `dev` fija ahora el puerto 3001.
- **Verificación:** Vitest (catálogo, cliente HTTP, carrito), Playwright con red simulada contra una compilación de producción y una comprobación real de solo lectura contra la base compartida (estado vacío). Detalle en el informe de la spec 004.

## Estructura
`modules/products/` (categorías y productos: `domain/`, `application/`, `infrastructure/`, `entry-adapters/`) y `modules/catalog/` (lectura pública, modelo de consulta propio). La autorización por rol y por propiedad del puesto vive en los casos de uso; el puesto se consulta mediante el puerto `PuestoConsultaPort`, cuyo adaptador usa la API pública del módulo Comerciantes.
