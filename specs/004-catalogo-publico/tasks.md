# Tasks: Experiencia del catálogo público y presentación del carrito (004)

**Entrada:** [spec.md](spec.md), [plan.md](plan.md), [contracts/ui-catalogo.md](contracts/ui-catalogo.md). Pruebas antes o junto con la implementación (principio IX).

## Estado de ejecución y de integración (2026-11-17)

Esta spec registra dos estados distintos. **Las marcas `[x]` y las tablas de resultados indican lo ejecutado y verificado localmente en la fecha de cada fase; no indican que el código esté integrado en `main`.**

| Parte | Tareas | Ejecutada y verificada localmente | Integrada en `main` |
|---|---|---|---|
| Causa raíz, catálogo, carrito, E1 y E4 (interfaz del frontend) | T001–T026, T045–T054 | Sí (resultados de cada fase; verificación del 2026-11-17 en la spec 002) | **Sí**: Pull Request #9 (`feat/frontend-carrito`) |
| **E2 y E3 (Demo)** | **T027–T044** | Sí (2026-11-08) y repetida el 2026-11-17 sobre `origin/main` (véase más abajo) | **Propuesta en el Pull Request de la Demo** (rama `feat/demo-local`); queda integrada cuando ese Pull Request se fusione. **No forma parte del incremento del frontend** |

### Integración de la Demo (rama `feat/demo-local`)

La Demo se integra con un Pull Request propio, separado del de Frontend. Contenido (22 archivos; los originales siguen sin seguimiento en el worktree de Pedidos y no se movieron ni se modificaron):

| Grupo | Archivos |
|---|---|
| Lanzador y entorno (3) | `ops/demo/README.md`, `ops/demo/demo-db.mjs`, `ops/demo/docker-compose.yml` |
| Guarda y datos (11) | `backend/scripts/base-desarrollo.{mjs,d.mts,spec.ts}`, `backend/scripts/demo/` (8 archivos: `datos-demo`, `fotos-demo` —cada uno con `.mjs`, `.d.mts` y `.spec.ts`—, `operaciones-demo.mjs` y `verificar-demo.mjs`) |
| Scripts y variable (4, modificados) | `db:dev:*` y `demo:api` en `backend/package.json`; `ALMACEN_URL_PUBLICA` en `backend/.env.example` y en `backend/src/shared/infrastructure/storage/supabase-almacen.adapter.ts` y su `.spec.ts` (solo se añaden líneas) |
| Navegador (4) | `frontend/e2e-demo/` (2), `frontend/playwright.demo.config.ts`, `frontend/public/demo/productos/.gitkeep` |

**Correcciones de coherencia (2026-11-17):**

- `ops/demo/README.md`: los puertos son fijos —API `3000` y frontend `3001`— y se retira la variante de «puertos intercambiados», que dejó de ser posible cuando el script `dev` del frontend fijó el `3001` (T001). La fotografía de comprobación se busca en el origen del frontend (`http://localhost:3001/demo/productos/…`), no en el `3000`.
- T030 nombra `seed-demo.mjs` y `limpiar-demo.mjs`, que no existen. Las operaciones reales son `sembrar` y `limpiar` de `backend/scripts/demo/operaciones-demo.mjs`, que se invocan con `npm run db:dev:seed` y `npm run db:dev:limpiar` (`ops/demo/demo-db.mjs`). El texto original de T030 se conserva.
- `frontend/e2e-demo/inicio-real.spec.ts` no se citaba por nombre: verifica con la API real el inicio y las ofertas de la enmienda E4 (T053; CA-UI-04, 05, 08 y 10).
- Los ejemplos de E3 con `ALMACEN_URL_PUBLICA=http://localhost:3000` son valores de prueba del adaptador (un origen cualquiera) y no cambian. En la Demo el origen lo fija el lanzador con `--frontend` (por defecto `http://localhost:3001`).
- *2026-11-18:* notas fechadas en `spec.md` §9.1 (el `3000` etiquetado «demostración» es el puerto que ocupaba Next.js el 2026-11-08; hoy la Demo usa `3001` para las imágenes) y §8.6 (la estrategia «el seed no crea imágenes» quedó sustituida por E3). El texto original se conserva.

**Verificación del 2026-11-17** (rama `feat/demo-local` sobre `origin/main` = `658f717`; Windows 11, Node.js 24.19.0, PostgreSQL 17.11 en un contenedor local, sin Supabase y sin `.env`):

| Verificación | Resultado |
|---|---|
| Backend: `arquitectura`, `lint`, `build` | Correctos (106 módulos, 365 dependencias, sin violaciones) |
| Backend: `npm test` y `npm run test:e2e` | **329 / 329** (20 archivos) y **126 / 126** |
| Guarda, datos, fotografías y adaptador de Storage | `scripts/`: 51 / 51; `supabase-almacen.adapter.spec.ts`: 41 / 41 |
| Frontend: Vitest, ESLint y `tsc` | **177 / 177**, sin errores, sin errores |
| Base nueva con las 4 migraciones de `main` (contenedor temporal, ya eliminado) | `db:dev:migrate`, `db:dev:status` («up to date»); `db:dev:seed` ×2 (1.ª: 8 + 5 + 4 + 4 + 20 + 20 + 20 insertados; 2.ª: 0 insertados y 41 sin cambios); `db:dev:verificar` **16 / 16**; `db:dev:limpiar` sin tablas de pedidos; nuevo seed y `verificar` **16 / 16** |
| `mercado_dev` existente (contenedor `mercado-dev-db`, con un volcado previo de seguridad) | Seed ×2 sin cambios; `verificar` **16 / 16**; `limpiar` y nuevo seed con recuentos idénticos a los iniciales |
| Fotografía (archivo WebP sintético temporal, ya retirado) | `db:dev:fotos` asocia 1; la API devuelve `http://localhost:3210/demo/productos/palta-fuerte.webp` y 19 productos con `imagenes: []`; `verificar` **16 / 16**; `db:dev:fotos` retira la asociación |
| Navegador real (`playwright.demo.config.ts`, API de demostración en el puerto 3100) | **2 / 2** sin fotografías, con la fotografía y sobre la base nueva |

**Verificación del 2026-11-18** (mismo `origin/main` = `658f717`, mismo entorno; contenedor temporal `mercado-demo-verif-db` en `127.0.0.1:55434`, sin volumen con nombre, eliminado al terminar; `mercado-dev-db` y `mercado-test-db` no se usaron):

| Verificación | Resultado |
|---|---|
| Backend: `arquitectura`, `lint`, `build`, `npm test` | Correctos; **329 / 329** (20 archivos) |
| `scripts/` y adaptador de Storage | **92 / 92** (5 archivos) |
| Backend: `npm run test:e2e` | **125 / 126** sin `DATABASE_URL`: falla solo `test/app.e2e-spec.ts` (carga `AppModule` y `PrismaService` exige la variable; igual en `main` sin cambios). **126 / 126** con una `DATABASE_URL` local ficticia (`127.0.0.1:1`, sin servidor) |
| Frontend: Vitest, ESLint, `tsc`; Playwright con red simulada | **177 / 177**, sin errores, sin errores; **30 / 30** |
| Guarda (CA-DEMO-01) | Aborta sin conectarse con Supabase, el puerto 55433, otra base y un servidor no local |
| Base nueva | `migrate` (4 migraciones) y `status` («up to date»); seed ×2 (1.ª: 8 + 5 + 4 + 4 + 20 + 20 + 20; 2.ª: 0 insertados, recuentos idénticos); `verificar` **16 / 16**; `limpiar` → 0 filas; seed y `verificar` **16 / 16** |
| Aislamiento de `limpiar` (CA-DEMO-11) | Con un puesto ajeno de un comerciante de demostración: «ABORTADO sin cambios» (huella de `productos` idéntica). Sin bloqueos, una categoría ajena sobrevive a la limpieza |
| Fotografía (WebP sintético «PRUEBA», retirado) | `fotos` asocia 1 (2.ª ejecución: sin cambios; `otrasTablasSinCambios: true`); un `.webp` que no es WebP queda pendiente («no tiene la cabecera RIFF/WEBP»); `verificar` **16 / 16**; al retirarla, `fotos` desasocia 1 |
| Navegador real (`playwright.demo.config.ts`) | **2 / 2** con la fotografía (1 pintada, 19 «Sin imagen») y **2 / 2** sin ella (20 «Sin imagen») |

*Limitación de entorno (2026-11-18):* en Windows, si Vitest se inicia con la unidad en minúscula (`d:\…`, p. ej. desde Git Bash con `cd /d/…`), carga dos instancias de su ejecutor y los archivos e2e fallan con «Cannot read properties of undefined (reading 'config')». Con `D:\…` (PowerShell o `cd "D:/…"`) el resultado es el indicado. No depende del código de la Demo.

**Limitaciones y riesgos:**

- **No hay fotografías reales**: `frontend/public/demo/productos/` solo contiene `.gitkeep`; el archivo WebP de la prueba era sintético y no se incluye. Las fotografías deben ser propias o con licencia (E3).
- El `mercado_dev` preexistente tenía aplicada la migración `20261109000000_pedidos`, que solo existe en la rama de Pedidos; `main` tiene cuatro migraciones. La Demo funciona con ambos esquemas (`limpiar` comprueba si existen las tablas de pedidos), pero esa base quedó «por delante» del esquema de `main`.
- La API de demostración se inicia con claves de Supabase vacías: Storage, registro e invitaciones responden 503, y `SUPABASE_URL` solo se usa para verificar sesiones. Para usar el carrito con una cuenta real hay que vincularla con `db:dev:vincular`.
- No se ejecutaron `npm run test:db` (pruebas contra PostgreSQL del backend) ni las pruebas de navegador con red simulada del frontend en este worktree. *2026-11-18:* las de red simulada se ejecutaron (30 / 30); `test:db` sigue sin ejecutarse, porque usaría el contenedor `mercado-test-db` existente y la Demo no cambia repositorios ni migraciones.
- No se ejecutaron `db:dev:up`, `db:dev:stop` ni `db:dev:down`: actúan sobre `mercado-dev-db` y su volumen `mercado_dev_pgdata`, que conservan datos previos. El archivo de Compose se revisó (proyecto, red, volumen y puerto propios, sin política de reinicio).

## Phase 1: Causa raíz

- [x] T001 `frontend/package.json`: `dev`/`start` en el puerto 3001 — diagnóstico §2
- [x] T002 [P] `frontend/lib/api.test.ts`: clasificación de errores (sin conexión, no es la API, 5xx, 4xx con mensaje) — CA-CAT-08, CA-CAT-12
- [x] T003 `frontend/lib/api.ts`: `ErrorApi.codigo` y clasificación en `peticion()` — CA-CAT-08

## Phase 2: US1 — Ver productos al entrar (HU01, RF16) 🎯

- [x] T004 [P] `frontend/lib/catalogo.test.ts`: filtros ↔ URL, `hayFiltros`, etiquetas, rangos, `clasificarError` — CA-CAT-03, 08, 11
- [x] T005 `frontend/lib/catalogo.ts`: funciones puras y `useCatalogo` — CA-CAT-01, 05, 08, 11
- [x] T006 [P] `frontend/components/catalogo/TarjetaProducto.test.tsx` y `TarjetaProducto.tsx` — CA-CAT-04, CA-CAT-12
- [x] T007 `frontend/components/catalogo/EstadosCatalogo.tsx` — CA-CAT-05 a 08
- [x] T008 `frontend/components/catalogo/CatalogoVista.tsx` y `frontend/app/catalogo/page.tsx` — CA-CAT-01, 02, 05 a 11

## Phase 3: US2 — Buscar y filtrar de forma opcional (HU02, RF17, RF18)

- [x] T009 `frontend/components/catalogo/PanelFiltros.tsx` (lateral y diálogo) — CA-CAT-03, 09
- [x] T010 `frontend/components/catalogo/CatalogoVista.test.tsx` — CA-CAT-01, 03, 05 a 08, 10

## Phase 4: US3 — Presentación del carrito (HU04–HU06)

- [x] T011 Pruebas nuevas en `LineaCarrito.test.tsx` (−/+) y `CarritoVista.test.tsx` (resumen) — CA-CAR-01 a 04
- [x] T012 `frontend/components/carrito/LineaCarrito.tsx` y `CarritoVista.tsx` — CA-CAR-01 a 04
- [x] T013 Nota de enmienda en `specs/002-carrito/contracts/ui-carrito.md`

## Phase 5: Navegador, verificación y documentación

- [x] T014 `frontend/e2e/catalogo.spec.ts` (red simulada) — CA-CAT-01, 02, 07, 08, 09, 11
- [x] T015 Frontend: `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`; backend: `npm test`, `npm run test:e2e`
- [x] T016 Verificación real: backend :3000 + frontend :3001 contra la base real (estado vacío) — CA-CAT-06
- [x] T017 `frontend/README.md`, `README.md` y `docs/05-implementacion/03-productos-categorias-catalogo.md`

## Matriz de trazabilidad

| HU / RF | Criterios | Tareas | Pruebas |
|---|---|---|---|
| HU01 / RF16 | CA-CAT-01, 02, 04–08 | T004–T008, T014 | `catalogo.test.ts`, `CatalogoVista.test.tsx`, `TarjetaProducto.test.tsx`, `e2e/catalogo.spec.ts` |
| HU02 / RF17, RF18 | CA-CAT-03, 07, 11 | T004, T009, T010, T014 | `catalogo.test.ts`, `CatalogoVista.test.tsx`, `e2e/catalogo.spec.ts` |
| HU03 / RF19 | CA-CAT-04, A1 | T006 | `TarjetaProducto.test.tsx` |
| HU04–HU06 / RF20–RF24 | CA-CAR-01–04, CA-F1–F12 | T011–T013 | `LineaCarrito.test.tsx`, `CarritoVista.test.tsx`, `e2e/carrito.spec.ts` |
| AC09, AC10, DA13 | CA-CAT-09, 10 | T008, T009, T014 | `e2e/catalogo.spec.ts` |
| Regresión | CA-CAT-12 | T001–T003, T015 | todas las suites |

Las casillas se marcan a medida que cada tarea queda implementada **y** su prueba ejecutada; el resultado real se informa en la revisión.

## Resultados de verificación (2026-11-08, ejecutados)

| Verificación | Resultado |
|---|---|
| Frontend `npm test` (Vitest) | **115 / 115** en 10 archivos (incluye las pruebas previas del carrito sin cambios y las nuevas de catálogo, cliente HTTP y −/+) |
| Frontend `npm run lint` y `npx tsc --noEmit` | Sin errores |
| Frontend `npm run build` | Correcto; `/catalogo` estático con límite de Suspense |
| Navegador, `e2e/catalogo.spec.ts` | **8 / 8**. Ejecutado contra `next start` (puerto 3210) con red simulada, porque Next.js 16 no admite un segundo `next dev` mientras el servidor de desarrollo del responsable sigue activo |
| Navegador, `e2e/carrito.spec.ts` | **6 / 6** sobre la nueva presentación, en una copia temporal con las alertas acotadas a `<main>` (ver hallazgo H1). La copia del repositorio no se modificó |
| Backend `npm test` / `npm run test:e2e` (sin cambios) | **548 / 548** y **126 / 126** |
| Verificación real (solo lectura) | API real (:3100) + frontend compilado (:3210) contra la base compartida: 200 JSON en catálogo, categorías y puestos; se muestra «Todavía no hay productos publicados» y «0 productos»; sin «Error inesperado» |
| `npm run test:db` | No aplica: no cambia la persistencia |

### Hallazgos

- **H1 (prueba del carrito, previo a esta spec):** `e2e/carrito.spec.ts` busca `page.getByRole("alert")` sin acotar; Next.js añade siempre su anunciador de rutas (`#__next-route-announcer__`, `role="alert"`, en un shadow DOM abierto que Playwright atraviesa), lo que provoca una violación de modo estricto en dos pruebas. Corrección propuesta: `page.getByRole("main").getByRole("alert")` (tres líneas). **Resuelto (2026-11-17):** la corrección propuesta se aplicó en `e2e/carrito.spec.ts` (T027 de la spec 002) y el carrito pasa **6 / 6**; la suite completa de navegador, **30 / 30**. Las cifras «carrito 4 / 6» de las verificaciones anteriores quedan como registro histórico.
- **H2 (entorno):** la base compartida tiene aplicadas 2 de 5 migraciones (faltan `inventario`, `carrito`, `pedidos`); el catálogo no depende de ellas. Aplicarlas requiere orden explícita del equipo.
- **H3 (hueco R3):** el backend responde 500 sin `mensaje` ante errores no controlados (p. ej. base inaccesible); la interfaz ya lo distingue como «error del servidor», pero un filtro global con `mensaje` y 503 para la base sería más preciso.

## Phase 6: Enmienda E1 — barra lateral de categorías y rediseño (2026-11-08)

- [x] T018 [P] `lib/catalogo.test.ts`: sin precio en la URL ni en la consulta; iconos por `slug` — CA-CAT-13, CA-CAT-19
- [x] T019 `lib/catalogo.ts` y `lib/panelCategorias.ts` — CA-CAT-15, CA-CAT-17, CA-CAT-19
- [x] T020 [P] `components/SiteHeader.test.tsx`: marca como control (`aria-expanded`/`aria-controls`) o enlace; «Inicio» — CA-CAT-15, CA-CAT-18
- [x] T021 `components/SiteHeader.tsx` — CA-CAT-15, CA-CAT-18
- [x] T022 [P] `components/catalogo/CatalogoVista.test.tsx`: categorías reales y sus estados, selección inmediata, «Todos», sin precio, ocultar y mostrar desde el logotipo, panel móvil — CA-CAT-13 a 15, 17, 19
- [x] T023 `PanelCategorias.tsx` (sustituye a `PanelFiltros.tsx`), `CatalogoVista.tsx`, `EstadosCatalogo.tsx`, `TarjetaProducto.tsx`, `iconos.tsx` — CA-CAT-13 a 17, 19, 20
- [x] T024 `app/globals.css` (tokens `oliva-*`) y `app/layout.tsx` (Fraunces) — CA-CAT-20
- [x] T025 `e2e/catalogo.spec.ts`: transición y columnas en escritorio, panel móvil, foco, desborde, «Inicio» — CA-CAT-14 a 19
- [x] T026 Verificación: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npx playwright test e2e/catalogo.spec.ts`, contraste de los tokens y capturas

| HU / RF | Criterios E1 | Tareas |
|---|---|---|
| HU01 / RF16 | CA-CAT-16, 20 | T023, T025 |
| HU02 / RF17, RF18 | CA-CAT-13, 14, 19 (precio solo en la API: E1-A1) | T018–T019, T022–T023, T025 |
| HU03 / RF19 | CA-CAT-20 (tarjeta → detalle) | T023 |
| AC09, AC10 | CA-CAT-15, 17, 18 | T019–T022, T025 |

### Resultados de verificación de E1 (2026-11-08, ejecutados)

| Verificación | Resultado |
|---|---|
| Frontend `npx vitest run` | **148 / 148** en 10 archivos (antes 115). Nuevas: categorías reales y sus estados, selección inmediata, «Todos», sin precio, el logotipo como control (escritorio y móvil), panel móvil, marca e «Inicio» en el encabezado e iconos por `slug` |
| `npx tsc --noEmit` y `npx eslint` | Sin errores |
| `npm run build` | Correcto; `/catalogo` estático; las rutas dinámicas no necesitan Suspense adicional (el encabezado no usa `usePathname`: E1-A5) |
| Navegador, `e2e/catalogo.spec.ts` (`next dev`, puerto 3210, red simulada) | **15 / 15**: transición de 0,3 s y ninguna con movimiento reducido; 3 → 4 columnas a 1280 px al ocultar el panel; `inert` y sin foco al ocultarlo; sin desbordes a 360, 390, 768, 1024 y 1280 px; panel móvil con Esc, fondo y elección de categoría, y foco devuelto; «Inicio»; sin `precioMin` ni `precioMax` |
| Navegador, `e2e/carrito.spec.ts` | 4 / 6. Los 2 fallos son el hallazgo **H1** ya registrado (anunciador de rutas de Next.js con `role="alert"`), no son regresiones de E1 |
| Contraste de los tokens (cálculo oklch → sRGB) | Texto ≥ 6,9:1 (`olive-600` sobre blanco) y blanco sobre `oliva-700` 7,8:1. `olive-500` (4,26:1) solo se usa en iconos |
| Mutación (control de las pruebas) | Sin `inert` o sin cerrar el panel móvil al elegir, fallan 3 pruebas de `CatalogoVista.test.tsx` |
| Revisión visual | Capturas a 1440 px (panel visible, oculto y con categoría activa) y a 390 px (cerrado y abierto) |

**Hallazgo E1-H1:** con `inline-flex`, Chromium inserta espacios entre los hijos al calcular el nombre accesible y jsdom no; el nombre del logotipo-control se fija con `aria-label` para que sea igual en todos los navegadores.

## Phase 7: E2 — Entorno de demostración local (2026-11-08)

> **Integración:** propuesta en el Pull Request de la Demo (rama `feat/demo-local`); ejecutada y verificada localmente (2026-11-08) y de nuevo el 2026-11-17. Véase «Estado de ejecución y de integración».

- [x] T027 [P] `backend/scripts/base-desarrollo.mjs` y `base-desarrollo.spec.ts` — CA-DEMO-01
- [x] T028 `ops/demo/docker-compose.yml` y `ops/demo/demo-db.mjs` (`up`, `ping`, `migrate`, `status`, `seed`, `verificar`, `limpiar`, `vincular`, `api`, `stop`, `down`) — CA-DEMO-01, 02, 11
- [x] T029 [P] `backend/scripts/demo/datos-demo.mjs` y `datos-demo.spec.ts` — CA-DEMO-03, 05
- [x] T030 `backend/scripts/demo/seed-demo.mjs` (idempotente) y `limpiar-demo.mjs` — CA-DEMO-03, 04, 09, 11
  - *Nota (2026-11-17):* los archivos `seed-demo.mjs` y `limpiar-demo.mjs` no existen; las operaciones están en `backend/scripts/demo/operaciones-demo.mjs` (`sembrar`, `limpiar`).
- [x] T031 `backend/scripts/demo/verificar-demo.mjs` (API real, carrito con token local) — CA-DEMO-06, 07
- [x] T032 Scripts `db:dev:*` y `demo:api` en `backend/package.json`
- [x] T033 Ejecución: contenedor, `ping`, migraciones, seed ×2, verificación, limpieza y nuevo seed — CA-DEMO-01 a 07, 11
- [x] T034 Navegador real: `/catalogo` con la API de demostración — CA-DEMO-08
- [x] T035 Regresión: backend `npm test`, `test:e2e`, `arquitectura`; frontend Vitest — CA-DEMO-10

### Resultados de verificación de E2 (2026-11-08, ejecutados)

| Verificación | Resultado |
|---|---|
| Diagnóstico (solo lectura) | `backend/.env` apunta al Supabase compartido (pooler); no había PostgreSQL local; Docker Desktop estaba detenido; ningún contenedor usaba el puerto 55434 ni existía `mercado_dev` |
| Guarda y datos | `base-desarrollo.spec.ts` 12/12 y `datos-demo.spec.ts` 9/9; con una URL de Supabase o de `mercado_test`, `migrate` y `seed` abortan antes de conectarse |
| Contenedor y destino | `mercado-dev-db` sano en `127.0.0.1:55434`; `db:dev:ping` antes de migrar: `mercado_dev`, PostgreSQL 17.11, 0 tablas |
| Migraciones | `prisma migrate deploy`: las 5 migraciones aplicadas en «PostgreSQL database "mercado_dev" … at "127.0.0.1:55434"»; `migrate status`: «Database schema is up to date!» |
| Seed, 1.ª ejecución | 8 categorías, 5 usuarios (4 comerciantes sin `authId` + 1 cliente de prueba), 4 comerciantes, 4 puestos, 20 productos, 20 inventarios y 20 movimientos insertados; 0 imágenes |
| Seed, 2.ª ejecución | 0 insertados, 0 actualizados, 41 sin cambios; 20 inventarios existentes sin modificar; recuentos idénticos |
| Coherencia (solo lectura) | 20/20 inventarios con stock = saldo posterior del `INGRESO` (stock entre 40 y 200, 0 reservado); 20 productos visibles según las reglas del catálogo |
| API real (`db:dev:verificar`) | **13/13**: catálogo `total=20`; 8 categorías; 4 puestos; precio, unidad, puesto y categoría de los 20 iguales al seed; «papa» → Papa amarilla; Frutas → 5; orden; detalle; carrito 401 sin sesión, perfil CLIENTE, vacío → Palta ×2 (DEMO-A1, S/ 17.00) + Papa ×3 (DEMO-B2, S/ 11.40) = S/ 28.40 → vaciado |
| Limpieza | Un primer intento falló por un nombre de columna (`producto_imagenes."productoId"`); la transacción se revirtió sin cambios. Corregido: borra exactamente los datos de demostración (incluido el carrito del cliente de prueba) y el seed los restaura; verificación final de nuevo 13/13 |
| Navegador real (`playwright.demo.config.ts`) | **1/1**: `/catalogo` compilado con la API de demostración muestra «20 productos», las 8 categorías y los 4 puestos; Frutas → 5; búsqueda; detalle; «Sin imagen» |
| Regresión | Backend `npm test` 569/569, `test:e2e` 126/126, `arquitectura` sin violaciones; frontend Vitest 148/148, `tsc` y `eslint` sin errores. Sin cambios en `backend/src` |

## Phase 8: E3 — Fotografías locales de demostración (2026-11-08)

> **Integración:** propuesta en el Pull Request de la Demo (rama `feat/demo-local`), con el cambio de `ALMACEN_URL_PUBLICA` en el adaptador de Storage; ejecutada y verificada localmente (2026-11-08) y de nuevo el 2026-11-17. Véase «Estado de ejecución y de integración».

- [x] T036 [P] Pruebas del adaptador: sin variable, origen local, rutas peligrosas, variable no válida y subidas sin cambios — CA-IMG-01 a 04
- [x] T037 `supabase-almacen.adapter.ts` (`ALMACEN_URL_PUBLICA`) y `backend/.env.example` — CA-IMG-01 a 04
- [x] T038 [P] `fotos-demo.mjs` (archivo, ruta y validación WebP) y `fotos-demo.spec.ts` — CA-IMG-07
- [x] T039 `sembrarFotos` en `operaciones-demo.mjs`; orden `fotos` y `ALMACEN_URL_PUBLICA` en `ops/demo/demo-db.mjs` — CA-IMG-04, 06, 07
- [x] T040 `verificar-demo.mjs`: URL de imágenes por producto y autenticación — CA-IMG-05, 06
- [x] T041 `frontend/public/demo/productos/` y `ops/demo/README.md` (nombres y registro de procedencia) — CA-IMG-10
- [x] T042 `e2e-demo/catalogo-real.spec.ts`: HTTP 200, `image/webp`, pintado y «Sin imagen» — CA-IMG-08
- [x] T043 Ejecución: seed ×2, verificación de la API y navegador, con y sin el patrón temporal — CA-IMG-05 a 08
- [x] T044 Regresión: backend `test`, `test:e2e`, `lint`, `build`, `arquitectura`; frontend Vitest, `lint`, `build`, navegador del catálogo y del carrito — CA-IMG-09

| HU / RF | Criterios E3 | Tareas | Pruebas |
|---|---|---|---|
| HU01, HU03 / RF11, RF16, RF19 | CA-IMG-06 a 08 | T038–T043 | `fotos-demo.spec.ts`, `db:dev:verificar`, `e2e-demo/catalogo-real.spec.ts` |
| AC05 · contratos estables | CA-IMG-01 a 05 | T036, T037, T040 | `supabase-almacen.adapter.spec.ts`, `test:e2e`, `db:dev:verificar` |
| Regresión | CA-IMG-09 | T044 | todas las suites |

### Resultados de verificación de E3 (2026-11-08, ejecutados)

| Verificación | Resultado |
|---|---|
| Adaptador (`supabase-almacen.adapter.spec.ts`) | **41/41**: las 14 pruebas previas sin cambios + 27 nuevas (sin variable, igual que antes; origen local sin `/storage/v1/object/public/productos/`; rutas peligrosas; 9 valores no válidos → 503; subir y eliminar a Supabase sin cambios; demostración sin clave → 503) |
| Fotografías y datos (`fotos-demo.spec.ts`, `datos-demo.spec.ts`) | 92/92 en `scripts/` y almacenamiento; las 20 rutas pasan por el adaptador real y se resuelven en `http://localhost:3000/demo/productos/<archivo>` |
| Seed de fotografías con la carpeta vacía (×2) | 0 asociadas, 20 pendientes («falta»), `otrasTablasSinCambios: true` |
| Seed con un patrón sintético temporal (×2) | 1.ª: 1 insertada (`palta-fuerte.webp`, 24 768 bytes), `mango-kent.webp` rechazado («no tiene la cabecera RIFF/WEBP»: era un PNG); 2.ª: 1 sin cambios, 0 insertadas; `otrasTablasSinCambios: true` |
| API real (`db:dev:verificar`) | **16/16**: URL `http://localhost:3210/demo/productos/palta-fuerte.webp` y 19 con `imagenes: []`; archivos válidos = filas; token no válido → 401; carrito con el cliente de prueba |
| Navegador real (`playwright.demo.config.ts`) | **1/1**: la fotografía responde HTTP 200 `image/webp` y se pinta (`naturalWidth > 0`); los otros 19 productos muestran «Sin imagen» (incluido el PNG disfrazado) |
| Estado final | Patrón temporal retirado; el seed retiró 1 asociación; `mercado_dev`: 0 imágenes, 20 pendientes; verificación 16/16 |
| Regresión | Backend: `npm test` 609/609, `test:e2e` 126/126, `lint` sin errores (5 advertencias previas en pruebas del carrito), `build` y `arquitectura` correctos. Frontend: Vitest 148/148, `tsc`, `eslint` y `build` correctos; navegador con red simulada: catálogo 15/15 y carrito 4/6 (los 2 fallos son el hallazgo H1, como antes) |
| Sin cambios | `backend/src/modules/auth`, Pedidos, Inventario, migraciones, `backend/.env` y `frontend/.env.local` |

## Phase 9: E4 — Rediseño comercial (2026-11-08)

- [x] T045 Tokens, tipografía y diseño base (`globals.css`, `layout.tsx`) — CA-UI-01
- [x] T046 [P] Pruebas del encabezado y la barra inferior por rol, con `aria-current` — CA-UI-02, 03
- [x] T047 `SiteHeader.tsx` y nuevos iconos — CA-UI-02, 03
- [x] T048 [P] Pruebas de `TarjetaProducto` y `BotonAgregar` — CA-UI-05 a 07
- [x] T049 Componentes de `components/tienda/`, tarjeta y marcador — CA-UI-06, 07
- [x] T050 [P] Pruebas de `InicioVista` y `OfertasVista` — CA-UI-04, 05, 08
- [x] T051 Inicio y Ofertas — CA-UI-04, 05, 08
- [x] T052 Catálogo con el nuevo lenguaje; ajustes de sus pruebas — CA-UI-09
- [x] T053 `e2e/inicio.spec.ts` y ajustes de `e2e/catalogo.spec.ts`; navegador con la API real y capturas — CA-UI-03, 04, 10
- [x] T054 Verificación: Vitest, `tsc`, `eslint`, `build`, navegador del catálogo y del carrito, contraste — CA-UI-01, 11

| HU / RF | Criterios E4 | Tareas |
|---|---|---|
| HU01 / RF16 | CA-UI-04, 06, 09 | T049–T053 |
| HU02 / RF17, RF18 | CA-UI-04, 09 | T051–T053 |
| HU04 / RF20 | CA-UI-03, 07 | T047–T049 |
| AC09, AC10 | CA-UI-01 a 03, 10 | T045–T047, T053 |
| E1-A6 (sin datos inventados) | CA-UI-05, 08 | T048, T050, T051 |

### Resultados de verificación de E4 (2026-11-08, ejecutados)

| Verificación | Resultado |
|---|---|
| Vitest del frontend | **177/177** en 13 archivos (antes 148). Nuevas: encabezado y barra inferior por rol con `aria-current` (`SiteHeader.test.tsx`), agregar desde la tarjeta para cliente, visitante, otros roles, error y 401 (`AgregarAlCarrito.test.tsx`), inicio con datos reales, estados y sin datos inventados (`InicioVista.test.tsx`) y ofertas (`OfertasVista.test.tsx`) |
| `tsc`, `eslint` y `npm run build` | Sin errores; `/`, `/catalogo` y `/ofertas` estáticas; las rutas dinámicas compilan (la ruta activa se lee dentro de `<Suspense>`) |
| Navegador con red simulada (`next build` + `next start`) | Inicio **9/9** (datos, buscador, categoría, barra inferior y sin desbordes a 360, 390, 768, 1024 y 1280 px en inicio, catálogo y ofertas); catálogo **15/15** (incluido CA-CAT-02); carrito 4/6 (los 2 fallos son el hallazgo H1, como antes) |
| Navegador con la API real (`mercado_dev`) | **2/2**: catálogo e inicio (categorías, novedades, precios más bajos, puestos y recuentos reales) y capturas de escritorio y móvil |
| Contraste | Todos los pares de texto ≥ 4,5:1. El banner se corrigió tras medirlo (texto 3,41 → 5,48 y etiqueta 3,14 → 7,55) |
| CA-F12 | El visitante y los otros roles no ven ningún enlace «Carrito» (prueba unitaria y de navegador) |
