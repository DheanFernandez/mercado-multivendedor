# Implementation Plan: Experiencia del catálogo público y presentación del carrito (004)

**Spec:** [spec.md](spec.md) · **Contrato de interfaz:** [contracts/ui-catalogo.md](contracts/ui-catalogo.md) · **Fecha:** 2026-11-08

## Summary

Solo frontend. Se corrige la causa raíz del «Error inesperado.» (puerto del servidor de desarrollo y clasificación de errores del cliente HTTP), se rehace la vista `/catalogo` priorizando los productos (carga automática, filtros opcionales en panel lateral o diálogo, estado en la URL, estados diferenciados) y se reorganiza la presentación del carrito (lista + resumen lateral, botones −/+) sin cambiar su contrato.

## Technical Context

Next.js 16.4 (App Router, `cacheComponents: true`), React 19.3, TypeScript estricto, Tailwind CSS 4; pruebas con Vitest 4 + Testing Library (jsdom) y Playwright (red simulada, puerto 3210). Sin dependencias nuevas. `useSearchParams` exige un límite `<Suspense>` para el prerenderizado (docs de Next 16: `use-search-params.md`).

## Constitution Check

| Principio | Cumplimiento |
|---|---|
| I · Monolito modular | Sin cambios en el backend; no se añaden importaciones cruzadas ni lecturas de tablas ajenas |
| II · Clean Architecture | N/A al backend; en el frontend la lógica pura (`lib/catalogo.ts`) se separa de la presentación |
| III · Frontend | Next 16, React, TS estricto, Tailwind; consume solo `/api/v1`; responsive (AC09, AC10); ocultar controles es solo UX |
| VI · Pagos | El carrito sigue sin ofrecer pedido ni pago (CA-F11) |
| VII · Inventario | La interfaz no valida stock como control: −/+ solo evitan solicitudes que el servidor rechazaría; el servidor decide |
| VIII · Seguridad | Sin secretos; `history.replaceState` solo recibe la ruta actual con una consulta construida con `URLSearchParams` |
| IX · Calidad | Pruebas unitarias/componente (Vitest), navegador (Playwright), `lint` y `build`; regresión del backend (`npm test`, `npm run test:e2e`). `test:db` no aplica (no cambia la persistencia) |
| X · Trazabilidad | spec §3; tareas con CA; `docs/05-implementacion/03-…` actualizado al cerrar |

Restricciones del responsable: sin commits, push, merge, cambios de rama, reset, clean ni stash; sin tocar Pedidos, migraciones ni la base compartida; `docs/01`, ADR y C4 intactos. `.specify/feature.json` no se modifica (sigue apuntando a 003); la especificación se crea a mano porque el script de Spec Kit crea una rama.

## Project Structure

```text
specs/004-catalogo-publico/   spec.md · plan.md · tasks.md · contracts/ui-catalogo.md
frontend/
  package.json                      dev/start en el puerto 3001 (causa raíz)
  lib/api.ts                        ErrorApi.codigo + clasificación en peticion()
  lib/catalogo.ts                   NUEVO: filtros ↔ URL, etiquetas, rangos, clasificarError, useCatalogo
  components/iconos.tsx             NUEVO: iconos SVG
  components/catalogo/CatalogoVista.tsx     NUEVO
  components/catalogo/PanelFiltros.tsx      NUEVO
  components/catalogo/EstadosCatalogo.tsx   NUEVO
  components/catalogo/TarjetaProducto.tsx   tarjeta nueva; ImagenProducto intacto
  app/catalogo/page.tsx             servidor + Suspense
  components/carrito/CarritoVista.tsx       lista + resumen (aside)
  components/carrito/LineaCarrito.tsx       miniatura, −/+
  pruebas: lib/api.test.ts, lib/catalogo.test.ts, components/catalogo/*.test.tsx, e2e/catalogo.spec.ts, ampliaciones en components/carrito/*.test.tsx
```

## Dependencias y riesgos

| Riesgo | Mitigación |
|---|---|
| Los archivos del carrito están sin confirmar (trabajo de spec 002) | Respaldo previo fuera del repositorio; se conservan textos, roles y comportamiento que verifican sus pruebas |
| `lib/api.ts` y `package.json` tienen cambios pendientes del carrito | Cambios en zonas distintas; se informa para prepararlos por separado (`git add -p`) |
| Duplicar `-p 3001` (`npm run dev -- -p 3001`) | El último valor prevalece; se verifica al arrancar |

## Complexity Tracking

Sin excepciones a la constitución.

## Enmienda E1 · Plan breve (2026-11-08)

**Spec:** [§7 de spec.md](spec.md#7-enmienda-e1--barra-lateral-de-categorías-y-rediseño-visual-2026-11-08). Solo frontend, sin dependencias npm nuevas.

| Paso | Archivo | Qué cambia | CA |
|---|---|---|---|
| 1 | `lib/panelCategorias.ts` (nuevo) | Estado externo mínimo (`useSyncExternalStore`): panel registrado, visible en escritorio y abierto en móvil, consulta de medios `(min-width: 64rem)`; `alternar()` decide según el ancho | 15, 17 |
| 2 | `components/SiteHeader.tsx` | Marca con logotipo; es `button` (`aria-expanded`, `aria-controls`, indicador) cuando hay un panel registrado y un enlace a `/` en caso contrario; enlace «Inicio» | 15, 18 |
| 3 | `lib/catalogo.ts` | Se retiran el rango de precios y su validación; `leerFiltros` y `escribirFiltros` ignoran `precioMin` y `precioMax`; `iconoCategoria`/`claveCategoria` por `slug` | 13, 19 |
| 4 | `components/catalogo/PanelCategorias.tsx` (nuevo; sustituye a `PanelFiltros.tsx`) | Lista de categorías («Todos» y las de la API) con sus estados y el selector de puesto; se usa en la barra lateral y en el diálogo móvil | 13, 14, 17 |
| 5 | `components/catalogo/CatalogoVista.tsx` | Rejilla con columna lateral animada (`grid-template-columns`), `inert` al ocultarse, diálogo lateral en móvil y barra de resultados con «Categorías» y orden; sin diálogo de filtros | 14–17, 19 |
| 6 | `TarjetaProducto.tsx`, `EstadosCatalogo.tsx`, `iconos.tsx` | Estilo blanco y oliva, cuadrícula `auto-fill`, iconos de categoría | 16, 20 |
| 7 | `app/globals.css`, `app/layout.tsx` | Tokens `oliva-*` y `--font-display`; Fraunces mediante `next/font/google` (autoalojada) | 20 |
| 8 | Pruebas | `lib/catalogo.test.ts`, `CatalogoVista.test.tsx`, `SiteHeader.test.tsx`, `TarjetaProducto.test.tsx`, `e2e/catalogo.spec.ts` | 13–20 |

**Riesgos.** (a) jsdom no implementa `showModal()` ni `matchMedia`: las pruebas de componente los simulan, y el comportamiento real (foco, Esc, transición y columnas) se verifica en Chromium con Playwright. (b) `next/font/google` descarga la fuente al compilar: requiere red en `next build` y `next dev`, igual que Geist hoy. (c) `layout.tsx` y `globals.css` son comunes a todo el sitio: solo se añaden la variable de fuente y los tokens, sin cambiar el aspecto de las demás páginas.

## Enmienda E3 · Plan breve (2026-11-08)

**Spec:** [§9 de spec.md](spec.md#9-fotografías-locales-de-demostración--e3-2026-11-08). El cambio de producción se limita a **cómo se resuelve la URL pública de lectura**; las subidas a Supabase Storage no cambian.

| Paso | Archivo | Qué cambia | CA |
|---|---|---|---|
| 1 | `backend/src/shared/infrastructure/storage/supabase-almacen.adapter.spec.ts` | Pruebas nuevas: sin variable (igual que antes), origen local, rutas peligrosas, variable no válida, subidas sin cambios | IMG-01 a 04 |
| 2 | `backend/src/shared/infrastructure/storage/supabase-almacen.adapter.ts` | `urlPublica` usa `ALMACEN_URL_PUBLICA` si está definida y es válida; la validación de la ruta no cambia | IMG-01 a 04 |
| 3 | `backend/.env.example` | Documenta la variable opcional (vacía por defecto); no hay secretos | IMG-01 |
| 4 | `backend/scripts/demo/datos-demo.mjs` y `fotos-demo.mjs` (nuevo) | Archivo y ruta de cada producto; validación WebP sin dependencias | IMG-07 |
| 5 | `backend/scripts/demo/operaciones-demo.mjs` | `sembrarFotos` idempotente, con la huella de las demás tablas | IMG-07 |
| 6 | `backend/scripts/demo/verificar-demo.mjs` y `ops/demo/demo-db.mjs` | `ALMACEN_URL_PUBLICA` = origen del frontend; orden `fotos`; comprobaciones de las URL | IMG-04 a 06 |
| 7 | `frontend/public/demo/productos/.gitkeep`, `ops/demo/README.md` | Carpeta, nombres y registro de procedencia | IMG-10 |
| 8 | `frontend/e2e-demo/catalogo-real.spec.ts` | HTTP 200, `image/webp`, `naturalWidth` y «Sin imagen», según lo que devuelve la API | IMG-08 |

**Riesgos.** (a) Si hay un `nest start --watch` en marcha, cambiar `src` recompila `dist`; una API ya iniciada no cambia hasta reiniciarla. (b) `next start` solo sirve los archivos de `public/` presentes al compilar; `next dev` los sirve al momento. (c) No hay fotografías autorizadas en el repositorio: la verificación positiva usa un patrón sintético temporal que se elimina al terminar.

## Enmienda E4 · Plan breve (2026-11-08)

**Spec:** [§10 de spec.md](spec.md#10-rediseño-comercial-tipo-app-de-mercado--e4-2026-11-08). Solo frontend; sin dependencias npm nuevas (Plus Jakarta Sans se autoaloja con `next/font`).

| Paso | Archivos | CA-UI |
|---|---|---|
| 1 | `app/globals.css` (tokens) y `app/layout.tsx` (fuente y espacio para la barra inferior) | 01 |
| 2 | `components/iconos.tsx` (inicio, etiqueta, bolsa, usuario, flecha, visto) | 02, 03 |
| 3 | `components/SiteHeader.tsx` (encabezado y barra inferior; ruta activa dentro de `<Suspense>`) | 02, 03 |
| 4 | `components/tienda/`: `BotonAgregar` y `useAgregarAlCarrito` (aviso flotante), `CategoriasVisuales`, `BuscadorPrincipal`, `BannerPrincipal`, `PromoSecundaria`, `IlustracionMercado`, `EncabezadoSeccion`, `FondoSuave` | 04–07 |
| 5 | `components/catalogo/TarjetaProducto.tsx` (y `ImagenProducto` con marcador opcional), `CatalogoVista`, `PanelCategorias`, `EstadosCatalogo` | 06, 07, 09 |
| 6 | `app/page.tsx` + `components/inicio/InicioVista.tsx`; `app/ofertas/page.tsx` + `components/ofertas/OfertasVista.tsx` | 04, 05, 08 |
| 7 | Pruebas: `SiteHeader`, `TarjetaProducto`, `BotonAgregar`, `InicioVista`, `OfertasVista`, `CatalogoVista`; `e2e/inicio.spec.ts`; `e2e-demo` (API real) | 01–11 |
