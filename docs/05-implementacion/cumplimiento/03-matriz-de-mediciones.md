# Matriz de mediciones y evidencias

> **Fuente de los umbrales:** `docs/01-analisis-de-sistema/08-escenarios-atributos-calidad.md` y `04-atributos-de-calidad.md` (copiados, no modificados). Los parámetros de ejecución que la documentación no fija (tamaño de datos, duración, tasa de error) se declaran aquí como **parámetros de la prueba**, no como cambios a la línea base.
> **Estado general (2026-11-05): 2 de 8 escenarios medidos (EQ-04 y EQ-03, ambos cumplen).** Los otros seis siguen pendientes porque dependen de módulos que aún no existen. k6 se ejecuta con la imagen Docker `grafana/k6`; PostgreSQL desechable en Docker (`mercado-test-db`) en lugar de Testcontainers; MSW, Playwright, Pino y `dependency-cruiser` instalados; CI creado y sin ejecutar; siguen sin instalarse Toxiproxy, Lighthouse y OWASP ZAP.

## 1. Mediciones realizadas y pendientes

### 1.1 Realizadas (no son mediciones EQ)

Son verificaciones de calidad de código útiles como base, pero **no cuentan** como cumplimiento de ningún escenario EQ:

| Verificación | Resultado (2026-11-05) | Evidencia |
|---|---|---|
| Compilación y lint de backend y frontend, `prisma validate` | Código de salida 0 en las cinco | [resumen.md](../evidencias/linea-base-2026-11-05/resumen.md) |
| Pruebas unitarias | 155 de 155 | `unitarias.json` |
| Pruebas HTTP (repositorios en memoria) | 83 de 83 | `http.json` |
| Pruebas de base de datos (desarrollo) | 28 de 28 en la última ejecución; **no reejecutadas hoy** | `test/*.db-spec.ts` |
| `npm audit --omit=dev` (backend) | 0 vulnerabilidades | salida de consola de hoy, **no archivada** |

### 1.2 Pendientes: los 8 escenarios

| EQ | Atributo | Umbral exigido (copiado) | Bloqueada por | Estado |
|---|---|---|---|---|
| EQ-01 | AC04 Seguridad, AC08 | 100 % de Webhooks falsificados rechazados; 0 pedidos habilitados sin pago aprobado | Módulo `payments` y Webhook | **Pendiente** |
| EQ-02 | AC08 Integridad | Ninguna operación fallida deja reservas, pedidos o agrupaciones inconsistentes | `inventory`, `orders`; base desechable | **Pendiente** |
| EQ-03 | AC07 Concurrencia | 0 reservas incompatibles en el 100 % de las pruebas concurrentes | — (se mide la operación de reserva; falta repetirla con pedidos) | **MEDIDO 2026-11-05: 0 reservas incompatibles en 400/400 iteraciones y en k6 → cumple** ([evidencia](../evidencias/EQ-03/2026-11-05/README.md)) |
| EQ-04 | AC01 Rendimiento | Con 100 usuarios concurrentes, ≥ 95 % de las consultas del catálogo en < 2 s (propuesta por validar) | — | **MEDIDO 2026-11-05: p95 = 381,4 ms → cumple** ([evidencia](../evidencias/EQ-04/2026-11-05/README.md)) |
| EQ-05 | AC02 Escalabilidad | Alta de comerciantes y puestos solo con registro de datos, sin cambios de código | Flujo de compra completo | **Pendiente** |
| EQ-06 | AC03, AC11 | Ninguna operación confirmada se pierde (meta de disponibilidad por definir) | Pedidos, pagos, notificaciones | **Pendiente** |
| EQ-07 | AC05 Mantenibilidad | 0 archivos modificados fuera de la infraestructura y configuración de Pagos; misma suite de contrato aprobada con ambos adaptadores | `payments`, CI | **Pendiente** |
| EQ-08 | AC03, AC06, AC08 | 0 pagos procesados más de una vez; 0 pedidos con pago indefinido; conciliación ≤ 15 min | `payments` | **Pendiente** |

## 2. Herramientas: lo necesario frente a lo disponible

| Herramienta (según la documentación) | Escenarios | Disponible hoy | Qué falta |
|---|---|---|---|
| Vitest + Supertest | EQ-01, 03, 07, 08 | **Sí** (instalados y en uso) | — |
| Testcontainers (PostgreSQL desechable) | EQ-02, EQ-03 | **Sustituido** por la base desechable de Docker Compose (`mercado-test-db`, PostgreSQL 17, puerto 55433), operativa y migrada; se reinicia con `db:test:down` + `db:test:up` | Desviación declarada: mismo propósito (PostgreSQL desechable), distinta herramienta |
| MSW o nock | EQ-01, 06, 07, 08 | **Instalado** (`msw`) en el backend | Escribir las pruebas cuando existan los módulos |
| k6 | EQ-03, EQ-04 | No | Instalar `k6` (o usar la imagen `grafana/k6` con Docker) |
| Lighthouse | EQ-04 | No | `npx lighthouse` (necesita Chrome) |
| Playwright | EQ-05 (y medición de AC09) | **Instalado** (`@playwright/test` y Chromium) en el frontend | Flujo de compra completo |
| Toxiproxy | EQ-06, EQ-08 | No | Contenedor `ghcr.io/shopify/toxiproxy` (o MSW como alternativa que la documentación admite) |
| Pino + Sentry | EQ-06, EQ-08 | `pino` instalado (sin integrar); Sentry no | Integrar el registro estructurado (módulo de auditoría) |
| UptimeRobot | EQ-06 | No | Servicio externo; solo se usa «cuando se defina la meta», que aún no existe |
| OWASP ZAP | EQ-01 (complemento) | No | Imagen de Docker `zaproxy` |
| `dependency-cruiser` | EQ-07 (y AC05) | **Instalado y configurado** (`npm run arquitectura`): hoy 0 errores y 6 advertencias de límites entre módulos | Pasar la regla a «error» tras la deuda (DEC-03) |
| GitHub Actions | EQ-07 | Flujo creado en `.github/workflows/ci.yml` (con servicio PostgreSQL); **sin ejecutar** | Primera ejecución en un pull request |
| `git diff --stat` | EQ-05, EQ-07 | Sí | — |
| Simulador de notificaciones del Sandbox de Mercado Pago | EQ-01 | No | Credenciales Sandbox, clave del Webhook y URL pública |
| «Script de seed (Drizzle + Faker)» | EQ-05 | No | El proyecto usa **Prisma**: se usará un seed con Prisma y Faker (ver contradicciones en el plan) |

## 3. Entorno aislado común

Ninguna medición se ejecuta contra la base compartida de Supabase.

| Elemento | Definición |
|---|---|
| Base de datos | PostgreSQL 17 en el contenedor `mercado-test-db` (`ops/medicion/docker-compose.yml`), `127.0.0.1:55433`, base `mercado_test`, volumen propio descartable |
| Backend | `PORT=3100`, `DATABASE_URL=postgresql://…@localhost:55432/mercado_medicion`; migraciones con `prisma migrate deploy` solo contra esa base |
| Autenticación en pruebas | `SUPABASE_URL=http://localhost:54321` (ficticia, solo para el emisor del token) y `SUPABASE_JWT_SECRET=<secreto de prueba>`; los tokens se firman localmente con HS256 (el verificador ya admite esta ruta) y los usuarios se siembran con su `authId`. No se contacta a Supabase |
| Protección | Guarda `backend/scripts/base-aislada.mjs`: aborta si la URL no es exactamente la base local de Docker (rechaza Supabase, Neon y cualquier base remota); la usan el ejecutor, Vitest, las pruebas y el seed |
| Frontend (Lighthouse y Playwright) | Compilación de producción (`npm run build` y `npm start`) apuntando al backend local |
| Registro del entorno | CPU, RAM, versiones de Node, PostgreSQL y de cada herramienta, hash del commit y estado del árbol de trabajo en `entorno.txt` |

Limitación que se declara en cada informe: una medición en una sola máquina local no equivale a producción (no incluye latencia de red ni la capacidad real del proveedor); sirve para verificar el cumplimiento del umbral en las condiciones descritas.

## 4. Fichas de medición

### EQ-01 · Webhook falsificado o no autorizado

| Campo | Contenido |
|---|---|
| Herramienta | Vitest + Supertest + MSW; complemento: Simulador Sandbox y OWASP ZAP |
| Datos de prueba | 1 cliente, 1 pedido con 3 puestos, 1 pago `PENDIENTE`; respuestas simuladas de la API de pagos |
| Procedimiento | 1) Implementar `POST /api/v1/webhooks/mercado-pago`. 2) Suite `test/eq01-webhook.e2e-spec.ts` con **8 casos**: sin firma, firma alterada, marca de tiempo antigua, firma válida con pago no aprobado en la API, monto distinto, referencia de otro pedido, identificador inexistente, cuerpo malformado. 3) Para cada caso: respuesta 401 o rechazo, estado del pago y del pedido **sin cambios**, 0 productos habilitados, intento registrado. 4) Caso positivo: firma válida + aprobado + monto igual → un único cambio de estado. 5) Manual: enviar una notificación desde el simulador del Sandbox. 6) `zap-baseline.py` contra la instancia local |
| Umbral exigido | Rechazar el 100 % de las notificaciones falsificadas; 0 pedidos habilitados sin pago aprobado por la pasarela |
| Resultado obtenido | — (no medido) |
| Evidencia a guardar | `evidencias/EQ-01/<fecha>/`: salida JSON de Vitest, tabla casos-rechazados/casos-totales, consulta SQL del estado antes/después, captura del simulador, informe `zap.html`, `entorno.txt` |

### EQ-02 · Integridad del pedido multivendedor

| Campo | Contenido |
|---|---|
| Herramienta | Vitest + Testcontainers + SQL |
| Datos de prueba | 1 cliente; 3 puestos con productos de stock 5, 1 y 0 |
| Procedimiento | 1) Contenedor PostgreSQL nuevo y migraciones. 2) Registrar conteos de pedidos, subpedidos, reservas y suma de `stock_reservado`. 3) Confirmar un pedido con los tres productos (el tercero falla) y, aparte, forzar un error del repositorio tras la segunda reserva. 4) Repetir los conteos. 5) Comprobar que son idénticos y que la respuesta indica el producto no disponible |
| Umbral exigido | Ninguna operación fallida deja reservas, pedidos o agrupaciones por puesto inconsistentes |
| Resultado obtenido | — (no medido) |
| Evidencia a guardar | Salida de Vitest, consultas SQL con conteos antes/después, versión del contenedor, `entorno.txt` |

### EQ-03 · Concurrencia sobre el mismo stock

| Campo | Contenido |
|---|---|
| Herramienta | Vitest (`Promise.all`) + Testcontainers + SQL; k6 para volumen |
| Datos de prueba | Producto con stock físico 1; N clientes distintos (N = 2, 5 y 20); segunda serie con stock S = 10 y 200 clientes |
| Procedimiento | 1) Para cada N, 100 iteraciones: restablecer el stock, lanzar N confirmaciones simultáneas. 2) Verificar exactamente 1 éxito y N−1 respuestas controladas de falta de stock. 3) `SELECT count(*) FROM inventarios WHERE stock_reservado > stock_fisico` debe dar 0. 4) k6 con 200 usuarios virtuales durante 1 minuto: las reservas aceptadas deben ser exactamente S |
| Umbral exigido | 0 reservas incompatibles en el 100 % de las pruebas concurrentes |
| Resultado obtenido | **Vitest:** 400 de 400 iteraciones correctas (100 × N = 2, 5, 20 con stock 1: exactamente 1 éxito y N−1 faltas de stock; 100 × 200 clientes con S = 10: exactamente 10 éxitos y 190 faltas), 0 errores no controlados. **k6:** 200 VUs, 1 min, 13 943 solicitudes: exactamente 10 reservas aceptadas, 13 933 faltas de stock, 0 respuestas inesperadas. **SQL:** `stock_reservado > stock_fisico` = 0. Limitación: se mide `ReservarInventario` (lo que invocará el pedido), no un pedido completo; máquina única ([evidencia](../evidencias/EQ-03/2026-11-05/README.md)) |
| Evidencia a guardar | Salida de Vitest (300 iteraciones), resumen JSON de k6, resultado de la consulta SQL, `entorno.txt` |

### EQ-04 · Rendimiento del catálogo (medible hoy)

| Campo | Contenido |
|---|---|
| Herramienta | k6 (100 usuarios virtuales); complemento: Lighthouse |
| Datos de prueba (parámetros propuestos) | 50 comerciantes, 100 puestos, 20 categorías, 5 000 productos publicados, imágenes con URL ficticia; seed con Prisma + Faker |
| Procedimiento | 1) Levantar el entorno aislado y aplicar el seed. 2) Script k6 `ops/k6/catalogo.js`: 100 usuarios virtuales constantes durante 2 minutos; mezcla de listado paginado (40 %), búsqueda por texto (20 %), filtros de categoría/precio/puesto (20 %) y detalle de un producto (20 %). 3) Umbrales k6: `http_req_duration: p(95)<2000` y `http_req_failed: rate<0.01`. 4) Lighthouse (categoría rendimiento) sobre `/catalogo` con la compilación de producción |
| Umbral exigido | Con 100 usuarios concurrentes, al menos el 95 % de las consultas del catálogo responde en menos de 2 segundos (propuesta por validar). *La tasa de error no tiene valor en la documentación: 1 % es un parámetro de ejecución* |
| Resultado obtenido | **p95 = 381,4 ms** (umbral < 2 000 ms), 0 % de errores, 100 usuarios virtuales, 2 min, 10 886 solicitudes. Esfuerzo máximo (sin espera): p95 = 1 043 ms. Lighthouse **no se ejecutó** (complemento) |
| Evidencia guardada | `docs/05-implementacion/evidencias/EQ-04/2026-11-05/` (`README.md`, `entorno.txt`, `primaria/resumen.json`, `esfuerzo-maximo/resumen.json`) |

### EQ-05 · Escalabilidad de comerciantes y puestos

| Campo | Contenido |
|---|---|
| Herramienta | Seed (Prisma + Faker) + Playwright + `git diff --stat` |
| Datos de prueba | Estado base con 5 comerciantes; luego 5 comerciantes, 10 puestos y 200 productos nuevos |
| Procedimiento | 1) Anotar `git rev-parse HEAD` y el árbol limpio. 2) Registrar los nuevos puestos solo con datos (API de administración o seed). 3) Playwright recorre catálogo → producto del puesto nuevo → carrito → pedido → pago → preparación. 4) `git diff --stat <hash>` debe estar vacío en `backend/src` y `frontend/app` |
| Umbral exigido | La incorporación se hace solo mediante registro de datos, sin cambios en el código de los módulos |
| Resultado obtenido | — (no medido; requiere el flujo de compra completo) |
| Evidencia a guardar | Traza de Playwright, `git diff --stat` vacío, listado de los datos creados, `entorno.txt` |

### EQ-06 · Fallo de un servicio secundario

| Campo | Contenido |
|---|---|
| Herramienta | Toxiproxy (o MSW) + registros estructurados (Pino) |
| Datos de prueba | 10 pedidos en distintos estados; el servicio de notificaciones y Storage simulados caídos o lentos |
| Procedimiento | 1) Interponer Toxiproxy y activar una falla (corte y latencia de 30 s). 2) Ejecutar compra, recepción de la confirmación de pago y preparación. 3) Verificar que las operaciones se completan, que el error queda registrado y que los eventos pendientes permanecen para reintento. 4) Comparar los conteos de pedidos y pagos confirmados antes y después |
| Umbral exigido | Ninguna operación confirmada se pierde. La meta numérica de disponibilidad está por definir |
| Resultado obtenido | — (no medido) |
| Evidencia a guardar | Registros de error en JSON, conteos SQL, configuración del tóxico, `entorno.txt`. *Sentry y UptimeRobot dependen de servicios externos; si no se usan, se documenta* |

### EQ-07 · Intercambio del adaptador de pago

| Campo | Contenido |
|---|---|
| Herramienta | Vitest (contrato) + MSW + `dependency-cruiser` + `git diff --stat` + GitHub Actions |
| Datos de prueba | Casos de contrato de `PasarelaPagoPort`: crear cobro, consultar pago, reembolsar, error de red |
| Procedimiento | 1) Suite de contrato parametrizada con los dos adaptadores disponibles. 2) Cambiar el adaptador en la composición de Pagos. 3) `git diff --stat`: solo archivos de `modules/payments/infrastructure/**` y `payments.module.ts`. 4) `depcruise` sin importaciones del SDK de Mercado Pago fuera del adaptador. 5) Ejecución en un pull request |
| Umbral exigido | 0 archivos modificados fuera de infraestructura y configuración de Pagos; la misma suite de contrato aprobada con ambos adaptadores; regresión aprobada |
| Resultado obtenido | — (no medido) |
| Evidencia a guardar | Salida de la suite, `git diff --stat`, informe de `depcruise`, URL de la ejecución de Actions, `entorno.txt` |

### EQ-08 · Webhook duplicado o caída de la pasarela

| Campo | Contenido |
|---|---|
| Herramienta | Vitest + Supertest, MSW o Toxiproxy, SQL, registros |
| Datos de prueba | 5 pagos aprobados en la pasarela simulada; 10 reenvíos de cada notificación |
| Procedimiento | 1) Reenviar la misma notificación válida 10 veces (en serie y en paralelo): 1 cambio de estado, 1 efecto contable, 10 registros de notificación (9 marcados duplicados). 2) Apagar la API de pagos, dejar pagos pendientes sin Webhook, restablecerla y medir el tiempo hasta que la conciliación los actualiza. 3) Verificar 0 pagos en estado indefinido y reservas liberadas para los no aprobados |
| Umbral exigido | 0 pagos procesados más de una vez; 0 pedidos con estado de pago indefinido; conciliación en ≤ 15 minutos desde el restablecimiento |
| Resultado obtenido | — (no medido) |
| Evidencia a guardar | Salida de Vitest, conteos SQL, línea de tiempo de la conciliación (marcas de tiempo), registros, `entorno.txt` |

## 5. Mediciones adicionales derivadas de los criterios de evaluación

| ID | Criterio (copiado de `04-atributos-de-calidad.md`) | Herramienta | Procedimiento | Medible hoy |
|---|---|---|---|---|
| AC04 (usuarios) | «Los usuarios no deberán acceder a recursos ni ejecutar operaciones fuera de los permisos asignados a sus roles» | Vitest + Supertest | Prueba que recorre **todas las rutas × 6 identidades** y compara con la tabla de permisos; informe JSON/Markdown. Complemento: ZAP | **MEDIDO 2026-11-05: 198 de 198 casos conformes** ([evidencia](../evidencias/AC04/2026-11-05/matriz-autorizacion.md)); ZAP no ejecutado |
| AC05 | «Los cambios en un módulo deberán poder realizarse sin modificar innecesariamente las reglas de negocio de otros módulos» | `dependency-cruiser` | Reglas de módulos; criterio: 0 violaciones. Hoy se esperan al menos 6 | Sí, tras instalar la herramienta |
| AC09 | «1 sola transacción… y llegar al Checkout… en no más de 2 acciones desde la confirmación del pedido» | Playwright | Contar acciones desde «confirmar pedido» hasta la URL del Checkout; verificar 1 solo cobro para un pedido de 3 puestos | No (requiere pagos) |

## 6. Registro de evidencias

Estructura propuesta, sin alterar la línea base:

```text
docs/05-implementacion/evidencias/
├── linea-base-2026-11-05/            (existe)
└── EQ-0X/<aaaa-mm-dd>/
    ├── README.md        comando exacto, parámetros, umbral, resultado y veredicto (cumple / no cumple)
    ├── entorno.txt      hardware, versiones, hash del commit, estado del árbol
    ├── crudo/           salidas JSON/HTML de la herramienta
    └── consultas.sql    consultas de verificación utilizadas
```

**Regla:** un EQ solo pasa a «cumple» cuando existe su carpeta con el resultado medido, el comando para reproducirlo y la comparación explícita con el umbral.
