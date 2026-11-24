# Investigación (Fase 0): interfaz del carrito

Sin marcadores `NEEDS CLARIFICATION` pendientes tras `Clarifications` de 2026-11-06. Estas decisiones resuelven las incógnitas técnicas del plan.

## D1 — Componentes cliente, no Server Components

- **Decisión**: página `/carrito` y componentes del carrito como Client Components (`"use client"`), igual que `/cuenta` y `/catalogo`.
- **Razón**: la sesión vive en el navegador (cliente Supabase con cookies) y cada operación necesita el JWT; la guía local de Next (`01-getting-started/05-server-and-client-components.md`) indica Client Components para estado, eventos y APIs del navegador. Con `cacheComponents: true`, leer la sesión en el servidor exigiría `Suspense` y cookies; no aporta nada aquí.
- **Alternativas**: Server Component con `cookies()` (descartada: la sesión no es una cookie propia y duplicaría la autenticación); SWR/TanStack Query (descartada: dependencia nueva sin necesidad; `useCarga` ya cubre cargar y recargar).

## D2 — Fuente de verdad única: la respuesta de la API

- **Decisión**: cada POST/PATCH/DELETE devuelve el carrito completo; la interfaz reemplaza su estado por esa respuesta. No se calculan subtotales ni totales (RI-1, RI-2).
- **Razón**: evita errores de coma flotante y divergencias con las reglas R4–R7 del backend (líneas no vigentes no suman).
- **Alternativas**: actualización optimista (descartada: puede mostrar importes que el servidor rechaza, p. ej. por stock).

## D3 — Pruebas del frontend

- **Decisión**: Vitest + `jsdom` + Testing Library para unitarias y de componente; Playwright (ya instalado, Chromium disponible) para una prueba de navegador con red simulada.
- **Razón**: la constitución IX fija Vitest; el backend ya lo usa. La sesión de Supabase y la API del backend no se pueden usar con credenciales reales en pruebas (constitución VIII), por lo que la prueba de navegador intercepta las llamadas y se declara «con red simulada».
- **Alternativas**: `node --test` sin dependencias (descartada: sin jsdom ni utilidades de componente); Cypress (descartada: segunda herramienta de navegador); levantar el backend real con Supabase de verdad (descartada: requiere un token firmado por el proveedor y datos compartidos).

## D4 — Rol sin redirección en el detalle del producto

- **Decisión**: nuevo hook `useSesion()` que devuelve `visitante | cliente | otro` sin redirigir (el detalle es público); `/carrito` usa el componente `Acceso` existente con `["CLIENTE"]`, que redirige al login sin sesión y muestra «acceso restringido» si el rol no corresponde (CA-F8).
- **Razón**: `useAcceso` redirige siempre; el detalle no debe hacerlo. El encabezado ya resuelve el rol sin redirigir (se reutiliza su criterio sin refactorizarlo).
- **Alternativas**: reutilizar `useAcceso` en el detalle (descartada: expulsaría a los visitantes de una página pública).

## D5 — Cantidad editable

- **Decisión**: campo numérico por línea con botón «Actualizar» y validación previa (entero 1–10 000, CA-F4); botón «Quitar» por línea y «Vaciar carrito» con confirmación. Las líneas se bloquean mientras su solicitud está en curso (R4).
- **Razón**: cambios explícitos evitan ráfagas de solicitudes al teclear; el límite 10 000 viene de R3.
- **Alternativas**: botones +/- inmediatos (descartada: más solicitudes cruzadas y más pruebas de carrera).

## D6 — Mensajes de error

- **Decisión**: se muestra `mensaje` del servidor (ya en español, con las unidades disponibles en el 409), mapeando solo el estado 0 (sin conexión) y 401 (sesión caducada → ingreso). La interfaz no interpreta ni duplica reglas de negocio.
- **Razón**: una sola fuente de textos; coherente con `mensajeError` existente.
