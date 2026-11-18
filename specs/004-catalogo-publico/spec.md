# Especificación: Experiencia del catálogo público y presentación del carrito (004)

- **Tipo:** Regularización parcial de R3 (catálogo público) con mejora de experiencia. **No es un requisito nuevo.**
- **Origen:** diagnóstico del 2026-11-07 (error «Error inesperado.» en `/catalogo`), código y pruebas existentes, `docs/05-implementacion/03-productos-categorias-catalogo.md` y la matriz R3 de `docs/06-gobernanza-sdd/05-matriz-de-regularizacion.md`.
- **Fecha:** 2026-11-08 · **Estado:** aprobada por el responsable para implementar (instrucción del 2026-11-08).
- **Enmiendas:** [E1 · barra lateral de categorías y rediseño visual](#7-enmienda-e1--barra-lateral-de-categorías-y-rediseño-visual-2026-11-08) (2026-11-08). Sustituye CA-CAT-03 y CA-CAT-09 y retira la aclaración A3. [E2 · entorno de demostración](#8-entorno-de-demostración-local--e2-2026-11-08), [E3 · fotografías locales](#9-fotografías-locales-de-demostración--e3-2026-11-08) y [E4 · rediseño comercial](#10-rediseño-comercial-tipo-app-de-mercado--e4-2026-11-08) (2026-11-08).
- **Referencias visuales:** dos capturas aportadas por el responsable (un catálogo de productos frescos con filtros laterales, etiquetas de filtros activos, categorías en píldoras y tarjetas con foto; y un carrito con lista de productos y resumen lateral). Se adaptan al proyecto: **no** se incorporan valoraciones, insignias, envío, impuestos, cupones, dirección ni medio de pago, porque no existen en los requisitos ni en la API.

## 1. Alcance

| Dentro | Fuera (declarado) |
|---|---|
| Interfaz de `/catalogo`: carga automática, búsqueda y filtros opcionales, tarjetas, estados y adaptación a móvil | Cambios en la API del catálogo (ya lista sin filtros: verificado con `GET /api/v1/catalogo/productos` → 200) |
| Clasificación de errores del cliente HTTP (`lib/api.ts`) para no mostrar «Error inesperado.» ante fallos de conexión o de configuración | Filtro global de errores del backend (500 sin `mensaje`; 503 si la base no responde): queda como hueco de R3 |
| Puerto del servidor de desarrollo del frontend (3001), causa raíz del error | Disponibilidad o stock en la tarjeta (RF19: depende de Inventario; la API del catálogo no la devuelve) |
| **Presentación** del carrito (`/carrito`) según la referencia, sin cambiar su contrato de API ni sus reglas (spec 002) | Pedido, pago y Mercado Pago (spec 003 y siguientes); contador del carrito en el encabezado (ui-carrito.md) |
| Botones −/+ en la línea del carrito (envían la cantidad ±1 con la misma operación «Actualizar») | Datos de ejemplo en la experiencia real: solo existen en pruebas |

## 2. Diagnóstico que origina la especificación (verificado)

1. El frontend se inició con `npm run dev` (script `next dev`, sin puerto) y ocupó el puerto **3000**; la API NestJS no pudo escuchar (`listen EADDRINUSE :::3000`).
2. Con `NEXT_PUBLIC_API_URL=http://localhost:3000`, las peticiones a `/api/v1/**` llegaban al propio Next.js → **404 `text/html`**.
3. `peticion()` no podía leer JSON, no encontraba `mensaje` y mostraba **«Error inesperado.»**; `/cuenta` mostraba «No se pudo cargar su perfil.» por el mismo motivo.
4. La base compartida no tiene productos, categorías ni puestos: con la API en marcha, el catálogo real debe mostrar el estado **vacío**, no productos inventados.

## 3. Trazabilidad

| Elemento | HU | RF | ADR / RC / AC / DA | Criterios |
|---|---|---|---|---|
| Primera página automática, sin filtros previos | HU01 | RF16 | AC01 (EQ-04) | CA-CAT-01, CA-R3-03, CA-R3-04 |
| Búsqueda y filtros opcionales | HU02 | RF17, RF18 | AC09 | CA-CAT-03, CA-R3-04 |
| Tarjeta con foto, nombre, precio, categoría y puesto; enlace al detalle | HU01, HU03 | RF16, RF19 | — | CA-CAT-04, CA-R3-01, CA-R3-08 |
| Estados de carga, vacío, sin resultados y errores diferenciados | HU01, HU02 | RF16–RF18 | AC09 | CA-CAT-05 a CA-CAT-08 |
| Diseño adaptable y accesible | — | — | AC09, AC10, RC01, DA13 | CA-CAT-02, CA-CAT-09, CA-CAT-10 |
| Estado del catálogo en la URL | HU01, HU02 | RF16–RF18 | AC09 | CA-CAT-11 |
| Presentación del carrito | HU04–HU06 | RF20–RF24 | ADR-001, ADR-002 | CA-CAR-01 a CA-CAR-04 (+ CA-F1…CA-F12 de spec 002, sin cambios) |
| Sin regresiones | — | — | AC05 | CA-CAT-12 |

### Aclaraciones

- **A1 (RF19):** la tarjeta y el detalle no muestran disponibilidad; el catálogo no la expone. No se inventa.
- **A2 (RF18):** la API admite **una** categoría y **un** puesto por consulta; la interfaz usa selección única (no casillas múltiples como en la referencia).
- **A3 (rangos de precio) — retirada por E1:** los rangos rápidos (hasta S/ 5, S/ 5–10, S/ 10–20, más de S/ 20) son atajos de la interfaz sobre `precioMin`/`precioMax`; también se admite un rango libre.
- **A4 (hueco R3 desactualizado):** la matriz R3 indica «la interfaz no ofrece filtro por puesto», pero ya existía; esta especificación lo mantiene.
- **A5 (carrito):** el carrito no devuelve imagen del producto (contrato api-carrito.md); la miniatura de la línea es un marcador neutro, no una foto.

## 4. Criterios de aceptación — catálogo

| ID | Criterio (medible) | Prueba |
|---|---|---|
| CA-CAT-01 | Al abrir `/catalogo` sin parámetros se solicita **una** vez por montaje de la vista (en desarrollo, el modo estricto de React puede repetirla) `GET /api/v1/catalogo/productos` con `pagina=1`, `limite=24`, `orden=recientes` y sin `q`, `categoriaId`, `puestoId`, `precioMin` ni `precioMax`; las tarjetas recibidas se muestran sin ninguna acción del usuario | `CatalogoVista.test.tsx`, `e2e/catalogo.spec.ts` |
| CA-CAT-02 | Prioridad de los productos: no hay formulario que completar antes de ver productos; el borde superior de la primera tarjeta está a ≤ 360 px del inicio de la página a 1280×800 y a ≤ 420 px a 390×844 (antes: el formulario terminaba en 485 y 663 px) | `e2e/catalogo.spec.ts` |
| CA-CAT-03 | **Sustituido por CA-CAT-14 y CA-CAT-19 (E1).** Búsqueda y filtros opcionales: categoría (píldoras), precio (rangos rápidos o libre, validado: hasta 2 decimales, mín ≤ máx), puesto y orden. Cada filtro activo aparece como etiqueta con botón para quitarlo; «Limpiar filtros» vuelve a la página 1 sin filtros. La búsqueda se aplica al enviar (sin consultas por tecla) | `catalogo.test.ts`, `CatalogoVista.test.tsx` |
| CA-CAT-04 | La tarjeta muestra la primera imagen (o «Sin imagen»), el nombre, el precio y la unidad **tal como llegan** de la API, la categoría, el puesto (código · nombre) y, si existen, la presentación o un extracto de la descripción; enlaza a `/catalogo/{id}`. No muestra datos que la API no devuelva | `TarjetaProducto.test.tsx` |
| CA-CAT-05 | Carga: la primera vez se muestra una cuadrícula esqueleto con `role="status"` y el texto accesible «Cargando productos…»; al filtrar o paginar, los resultados anteriores permanecen (atenuados, `aria-busy`) hasta la respuesta | `CatalogoVista.test.tsx` |
| CA-CAT-06 | Catálogo vacío (`total = 0` sin filtros): «Todavía no hay productos publicados», distinto del mensaje sin resultados. El código de producción no contiene productos de ejemplo | `CatalogoVista.test.tsx`; verificación real |
| CA-CAT-07 | Sin resultados (`total = 0` con filtros): «No encontramos productos con esos filtros» y la acción «Limpiar filtros» | `CatalogoVista.test.tsx`, `e2e/catalogo.spec.ts` |
| CA-CAT-08 | Errores diferenciados con «Reintentar» (repite la última consulta): **sin conexión** (la solicitud no llega), **respuesta que no es de la API** (p. ej. 404 HTML), **error del servidor** (5xx) y **filtro no válido** (400 con `mensaje`). El catálogo nunca muestra «Error inesperado.»; en desarrollo, el caso «no es la API» añade la pista de revisar `NEXT_PUBLIC_API_URL` y el puerto | `api.test.ts`, `catalogo.test.ts`, `CatalogoVista.test.tsx`, `e2e/catalogo.spec.ts` |
| CA-CAT-09 | **Sustituido por CA-CAT-16 y CA-CAT-17 (E1).** Adaptable: sin desplazamiento horizontal a 360 px; 2 columnas en móvil y 3 en escritorio con panel lateral; en móvil los filtros se abren en un diálogo que se cierra con Esc o «Ver resultados» y devuelve el foco al botón | `e2e/catalogo.spec.ts` |
| CA-CAT-10 | Accesible: controles etiquetados, píldoras con `aria-pressed`, el recuento se anuncia (`aria-live`), todo operable con teclado | `CatalogoVista.test.tsx` |
| CA-CAT-11 | Los filtros y la página se reflejan en la URL (`/catalogo?q=…&categoriaId=…&pagina=2`); abrir esa URL reproduce la vista y «Atrás» desde el detalle la restaura | `catalogo.test.ts`, `e2e/catalogo.spec.ts` |
| CA-CAT-12 | Sin regresiones: `ImagenProducto` conserva su firma (detalle, panel, imágenes); una solicitud que no llega sigue diciendo «No se pudo conectar con el servidor.»; las pruebas del carrito y del backend siguen pasando | suites existentes |

## 5. Criterios de aceptación — presentación del carrito

| ID | Criterio (medible) | Prueba |
|---|---|---|
| CA-CAR-01 | Dos columnas desde `lg`: a la izquierda los grupos por puesto (una `region` por puesto, sin cambios en CA-F2/CA-F3); a la derecha un **resumen** (`complementary`) con el número de productos y de puestos, el subtotal de cada puesto (si hay más de uno), el total y el rótulo «Importe estimado»; una columna en pantallas estrechas sin desborde a 375 px | `CarritoVista.test.tsx`, `e2e/carrito.spec.ts` |
| CA-CAR-02 | Cada línea muestra una miniatura neutra, el nombre, el precio unitario con la unidad, el estado de disponibilidad, la cantidad editable con botones −/+, «Actualizar», «Quitar» y su subtotal | `LineaCarrito.test.tsx` |
| CA-CAR-03 | − envía `cantidad − 1` y + envía `cantidad + 1` con `actualizarCantidadCarrito`; − se deshabilita en 1 (para retirar se usa «Quitar») y + cuando la cantidad alcanza lo disponible; ambos se bloquean mientras hay una solicitud en curso | `LineaCarrito.test.tsx` |
| CA-CAR-04 | No se ofrece pedido ni pago (CA-F11): el resumen solo ofrece «Seguir comprando» | `CarritoVista.test.tsx`, `e2e/carrito.spec.ts` |

## 6. Reglas de interfaz

- Los importes se muestran como texto exacto de la API; la interfaz nunca suma ni multiplica importes.
- Ocultar o mostrar controles es experiencia de usuario; el backend autoriza cada operación.
- Diseño consistente con el proyecto: base zinc, `Contenedor`/`claseBoton`/`clasesCampo`; acento verde (`emerald`) solo para selección y filtros activos.
- **Tema claro fijo con fondo blanco** (decisión del responsable, 2026-11-08): la interfaz no sigue el modo oscuro del sistema operativo (`@custom-variant dark` en `app/globals.css`, `color-scheme: light`). Afecta a todo el sitio; las clases `dark:` quedan inactivas y se podrían reactivar con una clase `.dark` si el equipo lo decide.
- Ninguna dependencia nueva: iconos en SVG propio.

## 7. Enmienda E1 · Barra lateral de categorías y rediseño visual (2026-11-08)

- **Origen:** instrucción del responsable del 2026-11-08: una interfaz moderna, limpia y minimalista para un mercado de abastos peruano (blanco, verde oliva suave, tipografía elegante, fotografías y bastante espacio), con las categorías en una barra lateral que se oculta o se muestra al pulsar el logotipo.
- **Tipo:** cambio de presentación del catálogo público. **Solo frontend**: la API, los contratos y los requisitos no cambian.
- **Trazabilidad:** HU01, HU02 y HU03 · RF16, RF17, RF18 y RF19 · AC09 y AC10.

### 7.1 Decisiones y aclaraciones

- **E1-A1 (RF18, precio):** el responsable pidió eliminar de la interfaz el filtro por rango de precios. La API lo conserva (`precioMin` y `precioMax`, CA-R3-04), pero la interfaz deja de ofrecerlo: no lo lee de la URL ni lo envía. El orden por precio se mantiene. Por eso RF18 queda cubierto en la interfaz por **categoría y puesto**; el filtro por precio solo existe en la API. Es una decisión del responsable y se informa en la revisión.
- **E1-A2 (orden):** el contrato admite `recientes`, `nombre`, `precio_asc` y `precio_desc`. **No existe un orden por relevancia**, así que no se ofrece; «Más recientes» sigue siendo el orden por defecto.
- **E1-A3 (puesto):** se mantiene el filtro por puesto (A4, RF18), como selector dentro del panel lateral y debajo de las categorías.
- **E1-A4 (categorías):** solo se muestran las que devuelve `GET /api/v1/categorias` (las activas), en el orden recibido. El código de producción no contiene una lista de categorías. Cada nombre puede ir acompañado de un icono decorativo elegido por el `slug` (frutas, verduras, hortalizas, tubérculos, abarrotes, lácteos, carnes, pescados, panadería…) y, si el `slug` no es conocido, de un icono genérico. El icono no añade datos.
- **E1-A5 (control del panel):** el encabezado es común a todo el sitio, pero el logotipo solo actúa como control cuando la vista del catálogo está montada y registra su panel. En las demás páginas, y si no hay JavaScript, el logotipo sigue siendo un enlace a `/`. Así el encabezado no necesita `usePathname`, que con `cacheComponents` exigiría un límite de Suspense en las rutas dinámicas.
- **E1-A6 (sin datos inventados):** no se añaden descuentos, valoraciones, insignias de stock, recuentos por categoría ni otras funciones que la API no tenga.

### 7.2 Criterios de aceptación

| ID | Criterio (medible) | Prueba |
|---|---|---|
| CA-CAT-13 | **Categorías reales.** El panel lateral muestra «Todos» seguido de las categorías de `GET /api/v1/categorias`, en ese orden y sin ninguna lista fija. Mientras cargan aparece un esqueleto con `role="status"`. Si fallan, aparece el aviso «No se pudieron cargar las categorías» con «Reintentar», y el catálogo sigue funcionando. Si no hay ninguna, se muestran «Todos» y «Aún no hay categorías registradas» | `CatalogoVista.test.tsx` |
| CA-CAT-14 | **Selección inmediata.** Al pulsar una categoría se consulta `categoriaId=<id>` y `pagina=1`, sin un botón «Aplicar»; se escribe en la URL, se resalta (`aria-pressed="true"` y estilo activo) y el título de los resultados pasa a ser su nombre. «Todos» quita `categoriaId` y restaura el catálogo completo. La búsqueda, el puesto y el orden se conservan | `CatalogoVista.test.tsx`, `e2e/catalogo.spec.ts` |
| CA-CAT-15 | **Control del panel en escritorio (≥ 1024 px).** En `/catalogo`, el logotipo y el nombre «Mercado de Abastos» forman un `button` con `aria-controls` (el id del panel) y `aria-expanded`, que refleja el estado, y un indicador visual que cambia con él. Al pulsarlo, el panel se oculta con una transición de ≤ 300 ms (inmediata con `prefers-reduced-motion`) y queda `inert` (no recibe el foco y no está en el árbol accesible); al pulsarlo otra vez, reaparece. El estado se conserva al ir al detalle y volver dentro de la misma pestaña | `SiteHeader.test.tsx`, `CatalogoVista.test.tsx`, `e2e/catalogo.spec.ts` |
| CA-CAT-16 | **Cuadrícula adaptable.** El número de columnas depende del ancho disponible (tarjetas de ≥ 13,5 rem; 2 columnas por debajo de 640 px). A 1280×800 hay al menos 3 columnas con el panel visible y al menos una más con el panel oculto. No hay desplazamiento horizontal a 360, 390, 768, 1024 ni 1280 px, en ninguno de los dos estados | `e2e/catalogo.spec.ts` |
| CA-CAT-17 | **Móvil (< 1024 px).** El panel no ocupa espacio en la página. El logotipo y el botón «Categorías» de la barra de resultados abren un panel lateral superpuesto (diálogo modal que entra desde la izquierda) titulado «Categorías»; ambos controles exponen `aria-expanded`. El panel se cierra con «Cerrar», con Esc, al pulsar el fondo o al elegir una categoría (que se aplica), y el foco vuelve al control que lo abrió | `CatalogoVista.test.tsx`, `e2e/catalogo.spec.ts` |
| CA-CAT-18 | **Enlace a inicio.** La navegación principal incluye «Inicio» (`href="/"`) en todas las páginas. Fuera de `/catalogo`, el logotipo sigue siendo un enlace a `/` | `SiteHeader.test.tsx`, `e2e/catalogo.spec.ts` |
| CA-CAT-19 | **Sin filtro de precio.** La interfaz no muestra rangos de precio (ni atajos ni rango libre) ni una etiqueta de precio. `precioMin` y `precioMax` presentes en la URL se ignoran y nunca se envían a la API. El orden (E1-A2), la búsqueda (se aplica al enviar), el puesto (E1-A3), las etiquetas de filtros activos y «Limpiar todo» se mantienen | `catalogo.test.ts`, `CatalogoVista.test.tsx`, `e2e/catalogo.spec.ts` |
| CA-CAT-20 | **Sustituido por CA-UI-01 (E4).** **Diseño.** Fondo blanco con el acento verde oliva de los tokens `oliva-*` (`app/globals.css`), títulos en una tipografía con serifa (Fraunces, autoalojada por `next/font`) y texto en Geist. La tarjeta muestra la foto, el nombre, el puesto, el precio en soles y la unidad de venta (CA-CAT-04 sigue vigente). El texto tiene un contraste ≥ 4,5:1 (AA). Los estados de carga, vacío, sin resultados y error siguen siendo distintos (CA-CAT-05 a CA-CAT-08) | `TarjetaProducto.test.tsx`, cálculo de contraste de los tokens, revisión visual (capturas) |

Siguen vigentes CA-CAT-01, 02, 04 a 08 y 10 a 12. El límite de CA-CAT-02 se mide con el panel visible.

### 7.3 Fuera de alcance de E1

Cambios en la API o en los contratos; recuentos por categoría; categorías jerárquicas; persistir entre recargas la preferencia del panel (solo se conserva durante la sesión de la pestaña); la tipografía del resto del sitio (que `body` sigue fijando en Arial en `globals.css`); el detalle del producto, el carrito y los Pedidos (S-07).

## 8. Entorno de demostración local · E2 (2026-11-08)

> **Integración:** propuesta en el Pull Request de la Demo (rama `feat/demo-local`). Se ejecutó y verificó localmente (2026-11-08) y de nuevo el 2026-11-17; sus archivos no forman parte del Pull Request de Frontend. Véase [tasks.md](tasks.md), «Estado de ejecución y de integración».

- **Origen:** instrucción del responsable del 2026-11-08: mostrar el catálogo real de Next.js con datos de demostración guardados en una base **local** y servidos por las API reales del backend NestJS. Ningún producto vive en componentes React.
- **Tipo:** herramienta de desarrollo. **No cambia** el código de `backend/src`, los contratos, las migraciones ni los requisitos.
- **Trazabilidad:** HU01–HU06 · RF16–RF24 · AC05 (límites de arquitectura).

### 8.1 Objetivo y alcance

| Dentro | Fuera |
|---|---|
| Contenedor PostgreSQL propio `mercado-dev-db` (proyecto Docker `mercado-dev`), en `127.0.0.1:55434`, con la base `mercado_dev` y un volumen propio | `mercado_test` (pruebas desechables), Supabase compartido y contenedores de otros proyectos |
| `prisma migrate deploy` de las migraciones del repositorio | `migrate reset`, `db push` y cualquier operación destructiva |
| Seed idempotente: 8 categorías, 4 comerciantes con un puesto cada uno, 20 productos publicados y su inventario | Cuentas de Supabase, contraseñas, imágenes y pedidos |
| Lanzador de la API apuntando solo a `mercado_dev`; verificación real de las API, del carrito y del catálogo en el navegador | Cambios en `backend/.env` (sigue apuntando a Supabase) o en `frontend/.env.local` |

### 8.2 Aislamiento

Una guarda única (`backend/scripts/base-desarrollo.mjs`, con el mismo patrón que `base-aislada.mjs`) acepta **solo** `postgresql://…@127.0.0.1|localhost|[::1]:55434/mercado_dev`. Rechaza las URL que mencionan Supabase, `pooler` u otros proveedores remotos, el puerto 55433 y la base `mercado_test`. Todas las órdenes (`ping`, `migrate`, `seed`, `limpiar`, `verificar`, `vincular` y `api`) la evalúan **antes** de conectarse. `DATABASE_URL` del `.env` nunca se lee: la URL es `DEV_DATABASE_URL` o la URL por defecto. Antes de migrar, una consulta de solo lectura informa la base, el usuario, el puerto interno, la versión y las tablas existentes; si hay tablas sin el registro de migraciones de Prisma, la orden se detiene.

### 8.3 Criterios de aceptación

| ID | Criterio (medible) | Evidencia |
|---|---|---|
| CA-DEMO-01 | Toda operación pasa por la guarda; las URL remotas, `mercado_test`, el puerto 55433 u otra base abortan sin conectarse | `base-desarrollo.spec.ts`; salida de `db:dev:ping` |
| CA-DEMO-02 | `prisma migrate deploy` aplica las migraciones del repositorio en `mercado_dev` y `migrate status` informa el esquema al día | Salida real de la migración y del estado |
| CA-DEMO-03 | Hay 8 categorías activas, 4 comerciantes `ACTIVO` con un puesto `ACTIVO` cada uno y 20 productos `PUBLICADO` repartidos entre los 4 puestos y las 8 categorías. Los precios son > 0 con 2 decimales, las unidades son del enum `UnidadVenta` y cada producto tiene inventario con stock ≥ 40 y un movimiento `INGRESO` cuyo saldo posterior coincide con el stock | `datos-demo.spec.ts`; recuentos reales |
| CA-DEMO-04 | Una segunda ejecución del seed no inserta nada y los recuentos no cambian. Las claves son UUID fijos con el prefijo `d3e0000`. El inventario ya existente no se modifica | Salida real de dos ejecuciones |
| CA-DEMO-05 | No se crean cuentas de Supabase ni se guardan contraseñas. Los comerciantes de demostración no tienen `authId` (no pueden iniciar sesión). El cliente de prueba tiene un `authId` fijo que solo se autentica con un token firmado localmente durante la verificación. Una cuenta de Supabase **existente** puede vincularse como cliente indicando su `authId`, sin contraseña | Revisión del seed; verificación del carrito |
| CA-DEMO-06 | `GET /api/v1/categorias` devuelve 8, `GET /api/v1/puestos/publicos` devuelve 4 y `GET /api/v1/catalogo/productos` sin filtros devuelve `total = 20`. `q=papa` encuentra «Papa amarilla» y `categoriaId` de Frutas devuelve 5. El precio, la unidad y el puesto de los 20 coinciden con el seed | Verificación real de la API |
| CA-DEMO-07 | Con el cliente de prueba, el carrito empieza vacío. Al agregar productos de 2 puestos devuelve 2 grupos con los subtotales y el total esperados, y vaciarlo lo deja como al principio | Verificación real de la API |
| CA-DEMO-08 | Con el frontend apuntando a la API de demostración, `/catalogo` muestra «20 productos» y las 8 categorías, y filtra por categoría en un navegador real, sin red simulada | Playwright contra la API real |
| CA-DEMO-09 | **Sustituido por CA-IMG-07 (E3).** El seed no crea imágenes ni llama a Storage, y las tarjetas muestran «Sin imagen». No se escribe en el Storage compartido | Revisión del seed; recuento de `producto_imagenes = 0` |
| CA-DEMO-10 | No hay regresiones: siguen pasando `npm test`, `npm run test:e2e` y `npm run arquitectura` del backend y Vitest del frontend. No hay cambios en `backend/src` ni en los contratos | Resultados reales |
| CA-DEMO-11 | `db:dev:limpiar` borra, en una transacción, solo las filas con identificadores de demostración, y aborta si un pedido las referencia. `db:dev:down` elimina solo el contenedor y el volumen de demostración | Ejecución real de la limpieza y nuevo seed |

### 8.4 Modelo de datos requerido

| Tabla | Registros | Clave de demostración | Reglas que respeta |
|---|---|---|---|
| `categorias` | 8 | `d3e00001-…`; `slug` = `generarSlug(nombre)` | `slug` único con formato `^[a-z0-9]+(-[a-z0-9]+)*$`; `activa = true` |
| `usuarios` | 4 comerciantes + 1 cliente de prueba | `d3e00002-…`; correos `@demo.mercado.test` | Correo en minúsculas; rol del enum; comerciantes con `authId = null` |
| `comerciantes` | 4 | `d3e00003-…` | Un comerciante por usuario; `ACTIVO` |
| `puestos` | 4 | `d3e00004-…`; códigos `DEMO-A1`…`DEMO-D4` | Código `^[A-Z0-9][A-Z0-9-]{0,19}$` y único; `ACTIVO` |
| `productos` | 20 | `d3e00005-…` | `precio > 0`, `NUMERIC(10,2)`; `PUBLICADO`; nombre ≤ 150 y presentación ≤ 100 caracteres |
| `inventarios` | 20 | `d3e00006-…` | `0 ≤ reservado ≤ físico`; FK compuesta (producto, puesto) |
| `movimientos_inventario` | 20 (`INGRESO`) | `d3e00007-…` | Variación ≠ 0; saldo posterior = stock; `actor_id` = usuario comerciante |

### 8.5 Estrategia de seed idempotente

SQL parametrizado con `pg`, en **una transacción**. Antes de escribir, comprueba que ningún `slug`, correo o código de demostración esté ocupado por un registro ajeno; si lo está, aborta sin cambios. Cada fila usa `INSERT … ON CONFLICT (id) DO UPDATE … WHERE` (los datos difieren), de modo que la salida informa cuántas filas se insertaron, se actualizaron o no cambiaron. Así se restablecen los valores del seed sin duplicar nada. El inventario y su movimiento se crean solo si el producto aún no tiene inventario: nunca se reescribe un stock que el carrito o un pedido pudieran estar usando. El seed vive fuera de `backend/src` (`backend/scripts/demo/`), así que no se compila con la aplicación ni reinicia un `nest start --watch` en curso.

### 8.6 Estrategia de imágenes

`producto_imagenes.ruta` es una ruta dentro del bucket; la API construye `${SUPABASE_URL}/storage/v1/object/public/<bucket>/<ruta>`, y subir exige `SUPABASE_SERVICE_ROLE_KEY` (no configurada). No hay imágenes con licencia en el repositorio y no se usan enlaces externos ni imágenes inventadas. Por eso **el seed no crea imágenes** y las tarjetas muestran «Sin imagen». Para añadirlas más adelante: (1) conseguir fotografías con licencia (propias o CC0, con su atribución registrada); (2) subirlas desde el panel del comerciante (`POST /api/v1/productos/:id/imagenes`) contra un Storage **de desarrollo** (por ejemplo `supabase start`) configurado en el entorno del lanzador, nunca contra el Storage compartido.

> *Nota (2026-11-18):* esta estrategia quedó sustituida por la enmienda E3 (§9): `db:dev:seed` asocia al final las fotografías locales que existan (CA-IMG-07, que sustituye a CA-DEMO-09). Sin archivos, el resultado es el descrito aquí: ninguna imagen y «Sin imagen» en las tarjetas.

### 8.7 Pruebas de verificación

`base-desarrollo.spec.ts` y `datos-demo.spec.ts` (Vitest del backend). `db:dev:verificar` levanta la API compilada en el puerto 3100 contra `mercado_dev`, con un emisor de tokens local y un secreto generado en memoria, y comprueba CA-DEMO-06 y CA-DEMO-07 (las respuestas reales quedan en la salida). Playwright, sin red simulada, comprueba CA-DEMO-08 contra un `next start` compilado con esa API. Además se ejecutan las suites del backend (`npm test`, `npm run test:e2e`, `npm run arquitectura`) y el Vitest del frontend.

### 8.8 Limpieza

`npm run db:dev:limpiar` borra solo los datos de demostración: las líneas de carrito de esos productos, el carrito del cliente de prueba y los movimientos, inventarios, productos, puestos, comerciantes, usuarios y categorías de demostración, en ese orden y en una transacción. Si algún pedido los referencia, aborta. El reinicio completo es `npm run db:dev:down` (elimina solo `mercado-dev-db` y su volumen `mercado_dev_pgdata`) seguido de `up`, `migrate` y `seed`.

## 9. Fotografías locales de demostración · E3 (2026-11-08)

> **Integración:** propuesta en el Pull Request de la Demo (rama `feat/demo-local`), incluido el cambio de `ALMACEN_URL_PUBLICA` en el adaptador de Storage. Se ejecutó y verificó localmente (2026-11-08) y de nuevo el 2026-11-17. Véase [tasks.md](tasks.md), «Estado de ejecución y de integración».

- **Origen:** instrucción del responsable del 2026-11-08 (opción A aprobada tras el diagnóstico): mostrar fotografías locales de los 20 productos de demostración, leídas desde los datos que devuelve la API real del catálogo.
- **Diagnóstico:** el modelo admite la ruta (`producto_imagenes.ruta` es texto), pero la API siempre la convertía en `${SUPABASE_URL}/storage/v1/object/public/<bucket>/<ruta>`; no había forma de configurar otro origen público. Cambiar `SUPABASE_URL` habría roto la verificación de sesiones (opción C, descartada).
- **Tipo:** configuración opcional del adaptador de almacenamiento (`shared/infrastructure/storage`) más herramientas de demostración. **No cambia** el contrato `imagenes[].url` (sigue siendo una URL absoluta o `null`), el puerto `AlmacenArchivos`, la autenticación ni las subidas.
- **Trazabilidad:** HU01, HU03 · RF11 (imágenes de productos), RF16, RF19 · CA-CAT-04, CA-CAT-12 (`ImagenProducto` sin cambios) · CA-DEMO-09 (sustituido por CA-IMG-07: el seed asocia fotografías solo si existen).

### 9.1 Decisión: `ALMACEN_URL_PUBLICA` (solo lectura pública)

| Situación | `urlPublica(ruta)` | Subir y eliminar |
|---|---|---|
| Sin `ALMACEN_URL_PUBLICA` (producción hoy) | `${SUPABASE_URL}/storage/v1/object/public/<bucket>/<ruta>`, o `null` sin `SUPABASE_URL`. **Exactamente igual que antes** | Sin cambios: Supabase Storage con `SUPABASE_SERVICE_ROLE_KEY` |
| Con `ALMACEN_URL_PUBLICA=http://localhost:3000` (demostración) | `http://localhost:3000/<ruta>`; con la ruta `demo/productos/palta-fuerte.webp` → `http://localhost:3000/demo/productos/palta-fuerte.webp`, que Next.js sirve desde `frontend/public/` | **Sin cambios**: siguen yendo a `SUPABASE_URL` y exigen la clave de servicio; la API de demostración se lanza sin ella (503) |

> *Nota (2026-11-18):* el origen `http://localhost:3000` de esta tabla y de CA-IMG-02 refleja el 2026-11-08, cuando `next dev` ocupaba ese puerto (§2). Desde T001 el frontend usa el **3001** y la API el **3000**: el lanzador fija `ALMACEN_URL_PUBLICA` al origen del frontend (`http://localhost:3001` por defecto, o el valor de `--frontend`/`--imagenes`), nunca al de la API. Las pruebas del adaptador conservan `http://localhost:3000` como un origen cualquiera; la decisión no cambia.

- La ruta almacenada se valida igual con o sin la variable (`^[A-Za-z0-9][A-Za-z0-9._/-]{0,200}$`, sin `..` ni `//`): no se admiten URL absolutas, rutas que empiecen por `/` ni saltos de directorio.
- La variable solo admite `http:` o `https:`, sin credenciales, consulta ni fragmento; puede llevar una ruta base. Un valor no válido es un error de configuración (503), nunca una URL arbitraria.
- `SUPABASE_URL` sigue siendo la única fuente del emisor y del JWKS de Supabase Auth: la verificación de sesiones no cambia.
- El lanzador de la demostración (`ops/demo/demo-db.mjs`) fija `ALMACEN_URL_PUBLICA` al origen del frontend (`--frontend`, o `--imagenes` si se indica). `backend/.env` no se modifica.

### 9.2 Fotografías y seed

- **Carpeta:** `frontend/public/demo/productos/`. **Nombre:** `generarSlug(nombre del producto)` + `.webp` (tabla en `ops/demo/README.md`). **Ruta guardada:** `demo/productos/<archivo>`.
- **Procedencia:** solo fotografías autorizadas (propias o con licencia que lo permita), anotadas en el registro de `ops/demo/README.md`. No se descargan imágenes ni se agregan imágenes ficticias. Las pruebas que necesitan una imagen usan un **patrón sintético temporal** (rotulado «PRUEBA»), que se elimina al terminar y no forma parte de la demostración.
- **Seed (`db:dev:fotos`, también al final de `db:dev:seed`):** por cada producto de demostración, si su archivo existe, es un WebP válido (cabecera `RIFF`…`WEBP`, tamaño RIFF coherente y fragmento `VP8 `/`VP8L`/`VP8X`) y pesa ≤ 2 MB (el límite de subida), se crea o restablece **una** fila (`id` fijo `d3e00008-…`, `orden = 0`, texto alternativo = nombre del producto). Si no, se elimina esa fila de demostración y el producto vuelve a «Sin imagen». Si el producto ya tiene otra imagen en `orden = 0` (por ejemplo, subida desde el panel), no se toca y se informa. Solo escribe `producto_imagenes` de los productos de demostración, en una transacción y tras la guarda de `mercado_dev`.

### 9.3 Criterios de aceptación

| ID | Criterio (medible) | Evidencia |
|---|---|---|
| CA-IMG-01 | Sin `ALMACEN_URL_PUBLICA`, `urlPublica` devuelve exactamente la URL de Supabase Storage de siempre (o `null` sin `SUPABASE_URL`), y subir y eliminar no cambian | `supabase-almacen.adapter.spec.ts` (pruebas previas sin cambios y nuevas) |
| CA-IMG-02 | Con `ALMACEN_URL_PUBLICA=http://localhost:3000` (con o sin `/` final), `urlPublica('demo/productos/palta-fuerte.webp')` = `http://localhost:3000/demo/productos/palta-fuerte.webp` y **no** contiene `/storage/v1/object/public/productos/` | `supabase-almacen.adapter.spec.ts` |
| CA-IMG-03 | Con la variable, las rutas peligrosas se siguen rechazando; los valores no válidos de la variable (otro protocolo, credenciales, consulta, fragmento o texto que no es URL) producen 503 | `supabase-almacen.adapter.spec.ts` |
| CA-IMG-04 | Con la variable y la clave de servicio, subir sigue llamando a `${SUPABASE_URL}/storage/v1/object/<bucket>/…`; sin la clave, 503 sin llamar a la red. La API de demostración se lanza sin clave | `supabase-almacen.adapter.spec.ts`; revisión del lanzador |
| CA-IMG-05 | La autenticación no cambia: el módulo `auth` no se modifica; la API de demostración rechaza un token no válido (401) y acepta uno válido (verificación 13/13 o más) | `git diff`; `db:dev:verificar` |
| CA-IMG-06 | El contrato `imagenes[].url` no cambia: URL absoluta o `null`, mismos campos; con la variable, cada producto con fotografía devuelve `http://localhost:<puerto>/demo/productos/<archivo>` y los demás `imagenes: []` | `db:dev:verificar`; `npm run test:e2e` |
| CA-IMG-07 | El seed asocia solo archivos existentes y WebP válidos de ≤ 2 MB; sin archivo, no hay fila y la tarjeta muestra «Sin imagen». Es idempotente (la 2.ª ejecución no cambia nada) y la huella de productos, usuarios, inventarios, movimientos y carritos queda idéntica | `fotos-demo.spec.ts`; ejecución real |
| CA-IMG-08 | En el navegador, cada fotografía asociada responde HTTP 200 con `image/webp` y se pinta (`naturalWidth > 0`); los productos sin fotografía muestran «Sin imagen» | `e2e-demo/catalogo-real.spec.ts` y captura |
| CA-IMG-09 | No hay regresiones: backend `npm test`, `test:e2e`, `lint`, `build` y `arquitectura`; frontend Vitest, `lint`, `build` y pruebas de navegador del catálogo y del carrito | Resultados reales |
| CA-IMG-10 | Está documentado dónde colocar cada fotografía, con qué nombre, cómo registrar su procedencia y cómo verificarla | `ops/demo/README.md` |

### 9.4 Fuera de alcance de E3

Subir fotografías a Supabase Storage; miniaturas o varios tamaños; `next/image`; cambios en componentes React (la tarjeta sigue pintando la URL que llega de la API); Pedidos e Inventario.

## 10. Rediseño comercial tipo app de mercado · E4 (2026-11-08)

- **Origen:** instrucción del responsable del 2026-11-08, con una referencia visual de una app de delivery: home comercial, buscador destacado, categorías con iconos, banners, tarjetas de producto con acción de agregar y barra de navegación inferior en móvil; fondo superior suave. Se usan su composición y su estilo, **no** su marca ni sus contenidos. (Las dos imágenes recibidas eran idénticas; del «fondo superior» se toma el degradado cálido de la cabecera.)
- **Decisión del responsable (2026-11-08): «Solo datos reales».** El backend no tiene promociones, precio anterior, porcentajes, valoraciones ni indicadores de ventas. Los banners son **editoriales** (sin precios, porcentajes ni contadores inventados), las insignias solo usan datos reales y la sección «Ofertas» informa que aún no hay ofertas publicadas. E1-A6 sigue vigente.
- **Trazabilidad:** HU01–HU04 · RF16–RF20 · AC09, AC10 · spec 002 CA-F1, CA-F7, CA-F8 y CA-F12 (sin cambios: el enlace «Carrito» sigue siendo solo para clientes).
- **Enmiendas:** CA-CAT-20 (paleta y tipografía) queda sustituido por CA-UI-01. CA-CAT-04 se amplía con la acción de agregar (CA-UI-06 y CA-UI-07). Los demás criterios CA-CAT siguen vigentes.

### 10.1 Criterios de aceptación

| ID | Criterio (medible) | Evidencia |
|---|---|---|
| CA-UI-01 | **Sistema visual.** Tokens `marca-*` (primario `#5F6F3E`, oscuro `#4E5D33`), `crema-*` (fondo `#F7F5EF`, borde `#E7E2D8`), `tinta` (`#1E1E1E`), `tinta-suave` (`#6B6B6B`, sobre blanco o fondo), `tinta-media` (sobre promo) y `promo` (`#F3E7D6` y `#F8E6D9`). Tipografía Plus Jakarta Sans autoalojada por `next/font`. Todo texto tiene un contraste ≥ 4,5:1 | Cálculo de contraste; capturas |
| CA-UI-02 | **Encabezado.** Logotipo y «Mercado de Abastos». Enlaces Inicio, Catálogo, Ofertas, Carrito (solo cliente, CA-F12), los del rol (Mis productos o Administración) y Mi cuenta, o Ingresar y Crear cuenta. El enlace de la página actual lleva `aria-current="page"`. En móvil (< 768 px) el encabezado es compacto y los enlaces pasan a la barra inferior. En `/catalogo` el logotipo sigue controlando el panel (CA-CAT-15) | `SiteHeader.test.tsx`; navegador |
| CA-UI-03 | **Barra inferior móvil** (`< 768 px`, «Accesos rápidos»). Visitante: Inicio, Catálogo, Ofertas e Ingresar. Cliente: Inicio, Catálogo, **Carrito** (botón central destacado), Ofertas y Mi cuenta. Comerciante o administrador: Inicio, Catálogo, Ofertas, su panel y Mi cuenta. Usa `aria-current`, no aparece desde 768 px y nunca tapa el contenido | `SiteHeader.test.tsx`; `e2e/inicio.spec.ts` |
| CA-UI-04 | **Inicio** (`/`). (a) Hero con fondo suave, título, buscador `GET /catalogo?q=…` (funciona sin JavaScript) y botón «Ver catálogo». (b) Categorías visuales: «Todos» y las de la API, que enlazan a `/catalogo?categoriaId=…`. (c) Banner principal con 3 mensajes editoriales, selector accesible y sin avance automático. (d) «Novedades del mercado»: `orden=recientes`, 8 productos. (e) «Precios más bajos»: `orden=precio_asc`, 4 productos. (f) «Compra por puesto»: puestos públicos que enlazan a `?puestoId=`. (g) Franja promocional secundaria con el número **real** de puestos. Cada sección tiene estados de carga, vacío y error | `InicioVista.test.tsx`; `e2e/inicio.spec.ts`; capturas reales |
| CA-UI-05 | **Sin datos inventados.** No aparecen porcentajes, precios anteriores, valoraciones, insignias «Más vendido», «Popular», «Nuevo» u «Oferta», ni contadores falsos. Las insignias de las tarjetas muestran la categoría real | Pruebas de inicio, ofertas y tarjeta |
| CA-UI-06 | **Tarjeta de producto.** Imagen arriba con la categoría como insignia; nombre; presentación o extracto; puesto; precio en soles y unidad; acción circular abajo a la derecha. Todo el contenido enlaza al detalle y la acción va **fuera** del enlace (sin elementos interactivos anidados). Sin foto, el marcador «Sin imagen» muestra el icono de la categoría (`ImagenProducto` admite un marcador opcional; su firma anterior sigue igual) | `TarjetaProducto.test.tsx` |
| CA-UI-07 | **Agregar desde la tarjeta.** Cliente: el botón «Agregar X al carrito» envía `cantidad = 1` y muestra un aviso flotante `role="status"` («X agregado al carrito», con «Ver carrito»). Un error del servidor (p. ej. stock) muestra su mensaje en un aviso `role="alert"`; un 401 sigue CA-F7. Visitante: enlace «Ingresar para agregar X al carrito» a `/login`. Otros roles: sin acción | `BotonAgregar.test.tsx`; `CatalogoVista.test.tsx` |
| CA-UI-08 | **Ofertas** (`/ofertas`). Como no existe un modelo de promociones, muestra «Aún no hay ofertas publicadas», explica cuándo aparecerán y ofrece los precios más bajos reales (`orden=precio_asc`) y el catálogo | `OfertasVista.test.tsx`; captura |
| CA-UI-09 | **Catálogo con el nuevo lenguaje.** Hero suave con buscador, categorías visuales desplazables en móvil (filtran al instante, `aria-pressed`), barra lateral de escritorio, ordenación y tarjetas nuevas. Siguen vigentes CA-CAT-01, 02 y 04 a 19 | Suites del catálogo |
| CA-UI-10 | **Adaptable.** Sin desplazamiento horizontal a 360, 390, 768, 1024 y 1280 px en inicio, catálogo y ofertas. Cuadrículas de 2 columnas en móvil y de hasta 4 en escritorio | `e2e/inicio.spec.ts`, `e2e/catalogo.spec.ts`; capturas |
| CA-UI-11 | **Sin regresiones.** Siguen pasando las pruebas de Vitest y de navegador del catálogo y del carrito (salvo el hallazgo H1, ya registrado), además de lint, tipos y build. CA-F12 se mantiene | Resultados reales |

### 10.2 Fuera de alcance de E4

Modelo de promociones u ofertas reales (requeriría su propia especificación), favoritos, notificaciones, valoraciones, contador del carrito (ui-carrito.md), detalle del producto, carrito, cuenta y paneles (conservan su diseño actual) y cambios en el backend.
