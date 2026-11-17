# Contrato de interfaz: catálogo público (spec 004)

## Ruta

| Ruta | Acceso | Contenido | Criterios |
|---|---|---|---|
| `/catalogo` | público | `page.tsx` (servidor) → `<Suspense fallback={EsqueletoCatalogo}>` → `CatalogoVista` (cliente) | CA-CAT-01…12 |

Parámetros de URL (todos opcionales; los valores por defecto no se escriben): `q`, `categoriaId`, `puestoId`, `precioMin`, `precioMax`, `orden` (`recientes` · `precio_asc` · `precio_desc` · `nombre`), `pagina` (≥ 1). Un valor no válido se ignora. La URL es la única fuente del estado: los cambios se escriben con `window.history.replaceState`, que Next.js 16 integra con `useSearchParams` sin pedir de nuevo la página al servidor (docs: «Native History API»).

## Consulta a la API

`GET /api/v1/catalogo/productos?pagina&limite=24&orden[&q][&categoriaId][&puestoId][&precioMin][&precioMax]` (contrato existente, sin cambios). Auxiliares: `GET /api/v1/categorias`, `GET /api/v1/puestos/publicos`; si fallan, el catálogo sigue funcionando sin esas opciones.

## Componentes

| Componente | Responsabilidad |
|---|---|
| `CatalogoVista` | estado de filtros ↔ URL, consulta, cabecera con búsqueda, etiquetas de filtros activos, píldoras de categoría, encabezado de resultados (título, recuento, orden), cuadrícula, paginación y estados |
| `PanelFiltros` | precio (rangos rápidos y libre) y puesto; panel lateral en `lg`, diálogo en móvil |
| `TarjetaProducto` | foto, nombre, precio/unidad, categoría, puesto, presentación o extracto; enlace al detalle. `ImagenProducto` sin cambios de firma |
| `EstadosCatalogo` | `EsqueletoCatalogo`, `CatalogoVacio`, `SinResultados`, `ErrorCatalogo` (con «Reintentar») |
| `lib/catalogo.ts` | funciones puras (`leerFiltros`, `escribirFiltros`, `hayFiltros`, `etiquetasFiltros`, `clasificarError`, rangos) y el hook `useCatalogo` |

## Estados visibles

| Estado | Condición | Texto principal |
|---|---|---|
| Cargando | primera consulta | «Cargando productos…» (`role="status"`) |
| Actualizando | consulta en curso con resultados previos | resultados atenuados, `aria-busy="true"` |
| Vacío | 200, `total = 0`, sin filtros | «Todavía no hay productos publicados» |
| Sin resultados | 200, `total = 0`, con filtros | «No encontramos productos con esos filtros» + «Limpiar filtros» |
| Sin conexión | `ErrorApi.codigo = SIN_CONEXION` | «No pudimos conectar con el mercado» |
| No es la API | `RESPUESTA_NO_API` | «El catálogo no está disponible en este momento» (+ pista en desarrollo) |
| Error del servidor | 5xx | «El catálogo tuvo un problema al cargar» |
| Filtro no válido | 400 con `mensaje` | el mensaje del servidor |

Todos los errores usan `role="alert"` y ofrecen «Reintentar».

## Clasificación de errores del cliente HTTP (`lib/api.ts`)

| Situación | `estado` | `codigo` | Mensaje |
|---|---|---|---|
| `fetch` rechaza (API apagada, red, CORS) | 0 | `SIN_CONEXION` | «No se pudo conectar con el servidor.» (sin cambios) |
| Respuesta sin JSON (HTML u otro) | el recibido | `RESPUESTA_NO_API` | «El servidor no respondió como la API del mercado.» |
| Error con `mensaje` | el recibido | `codigo` del cuerpo | `mensaje` del cuerpo (sin cambios) |
| 5xx JSON sin `mensaje` | el recibido | `ERROR_SERVIDOR` | «El servidor tuvo un problema. Inténtelo de nuevo en unos minutos.» |
| 4xx JSON sin `mensaje` | el recibido | — | «No se pudo completar la operación.» |

## Enmienda E1 (2026-11-08)

**Parámetros de URL.** `q`, `categoriaId`, `puestoId`, `orden` y `pagina`. `precioMin` y `precioMax` **se ignoran** (CA-CAT-19); la API los sigue admitiendo.

**Componentes**

| Componente | Responsabilidad |
|---|---|
| `SiteHeader` · marca | Logotipo y «Mercado de Abastos». Con un panel registrado es un `button` con `aria-controls`, `aria-expanded` e indicador; sin él, un enlace a `/`. Enlace «Inicio» independiente |
| `lib/panelCategorias.ts` | `usePanelCategorias()`: `disponible`, `expandido`, `escritorio`, `visibleEscritorio`, `abiertoMovil`, `alternar()`, `abrirMovil()` y `cerrarMovil()`. `useRegistrarPanel()` lo llama la vista del catálogo. Ids `panel-categorias` (lateral) y `panel-categorias-movil` (diálogo) |
| `PanelCategorias` | «Todos» y las categorías de la API (botones con `aria-pressed`), sus estados (cargando, error con «Reintentar», sin categorías) y el selector «Puesto». Sustituye a `PanelFiltros` |
| `CatalogoVista` | Búsqueda arriba; rejilla `[panel | resultados]` con la columna lateral animada; diálogo lateral en móvil; barra de resultados (título, recuento, «Categorías» en móvil y orden); etiquetas de filtros activos; cuadrícula, paginación y estados |

**Estados del panel**

| Ancho | Estado inicial | Control | Oculto significa |
|---|---|---|---|
| ≥ 1024 px | visible | logotipo | columna de 0 rem, contenido `inert` e invisible; la cuadrícula ocupa todo el ancho |
| < 1024 px | cerrado | logotipo o «Categorías» | el diálogo está cerrado; se abre superpuesto desde la izquierda |

**Estados nuevos de las categorías:** cargando («Cargando categorías…», `role="status"`), error («No se pudieron cargar las categorías» y «Reintentar») y sin categorías («Aún no hay categorías registradas»).
