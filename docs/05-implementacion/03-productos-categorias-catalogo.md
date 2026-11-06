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

## Estructura
`modules/products/` (categorías y productos: `domain/`, `application/`, `infrastructure/`, `entry-adapters/`) y `modules/catalog/` (lectura pública, modelo de consulta propio). La autorización por rol y por propiedad del puesto vive en los casos de uso; el puesto se consulta mediante el puerto `PuestoConsultaPort`, cuyo adaptador usa la API pública del módulo Comerciantes.
