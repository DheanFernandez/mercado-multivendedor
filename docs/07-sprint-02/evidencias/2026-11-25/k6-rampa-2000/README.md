# EQ-04 ampliada · Carga progresiva del catálogo hasta 2000 VUs (25/11/2026)

**Veredicto contra EQ-04: PARCIAL.** El criterio documentado (p95 < 2 s con 100 usuarios concurrentes) **se cumple** en el tramo de hasta 100 VUs (p95 = 778 ms) y **apenas** en el tramo 100–500 VUs (p95 = 1 934 ms). **No se cumple** desde 500 VUs ni con 2000. La prueba se completó entera (10 min) y **sin un solo error HTTP**: la degradación fue de latencia, no de fallos.

> El criterio de EQ-04 solo fija 100 usuarios. Los tramos superiores son una **medición exploratoria** de dónde deja de cumplirse el mismo umbral; no son un requisito del Sprint 1.

## 1. Qué se midió

| Elemento | Valor |
|---|---|
| Escenario y umbral (cita textual de [`08-escenarios-atributos-calidad.md`](../../../../01-analisis-de-sistema/08-escenarios-atributos-calidad.md), EQ-04, «Medida») | «**Propuesta por validar:** con 100 usuarios concurrentes, al menos el 95 % de las consultas del catálogo responde en menos de 2 segundos.» → `http_req_duration: p(95)<2000` |
| Parámetro propio de la prueba (no es requisito) | `http_req_failed: rate<0.01`, igual que en EQ-04 (la documentación pide medir la tasa de errores pero no fija un valor) |
| Script | [`ops/k6/catalogo-rampa.js`](../../../../../ops/k6/catalogo-rampa.js) (no se modificó `catalogo.js`) |
| Patrón copiado de EQ-04 | Mismas rutas del catálogo público; mezcla 40 % listado, 20 % búsqueda, 20 % filtros combinados, 20 % detalle; espera `PENSAR = 1` → 0,5–1,5 s (media 1 s), el escenario del p95 = 381,4 ms ([EQ-04](../../../../05-implementacion/evidencias/EQ-04/2026-11-05/README.md)) |
| Executor | `ramping-vus`, 6 etapas |
| Fecha | 25/11/2026, ≈ 16:39–16:49 (hora local) |
| Comando | `docker run --name k6-rampa -v ops/k6:/scripts -v <esta carpeta>:/resultados -e BASE_URL=http://host.docker.internal:3100 grafana/k6 run --summary-export=/resultados/resumen.json /scripts/catalogo-rampa.js` |

Etapas: 0→100 VUs (1 min) · 100→500 (2 min) · 500→1000 (2 min) · 1000→2000 (2 min) · 2000 sostenido (2 min) · 2000→0 (1 min). Cada solicitud lleva la etiqueta `tramo` con la etapa en la que se emitió.

## 2. Entorno

| Elemento | Valor |
|---|---|
| CPU | Intel Core i7-1255U, 10 núcleos / 12 hilos |
| RAM | 23,7 GB |
| Sistema | Windows 11 Home (10.0.26300), Docker Desktop 29.8 |
| Topología | **Todo en una máquina:** k6 (contenedor) → `host.docker.internal:3100` → backend (proceso Node en Windows) → PostgreSQL (contenedor) |
| Backend | `npm run build` + `node dist/main`, `NODE_ENV=production`, puerto 3100, Node v24.13.1, pool de conexiones por defecto (10 en EQ-04; no se cambió ni se volvió a verificar). El código no se modificó; el registro es el de Nest por defecto (solo mensajes de arranque, sin log por solicitud) |
| Base | `mercado-k6-db`, PostgreSQL 17.11 (`postgres:17-alpine`), `127.0.0.1:55433`, base `mercado_test`, 4 migraciones con `prisma migrate deploy`. Datos en volumen de Docker (**no** en tmpfs como en EQ-04) |
| k6 | Imagen `grafana/k6:latest` (digest `sha256:3d8e5c7f…`; la salida no imprime el número de versión) |
| Datos (sintéticos) | 50 usuarios comerciantes, 50 comerciantes, 100 puestos, 20 categorías, **5 000 productos PUBLICADOS** y **5 000 inventarios** (stock 0–200). Productos con `npm run seed:medicion` (`faker.seed(20261105)`); inventario con [`ops/k6/datos/inventario-sintetico.sql`](../../../../../ops/k6/datos/inventario-sintetico.sql). El catálogo no lee `inventarios`, así que esa tabla no influye en lo medido |
| Verificación de la base | El backend se comprobó conectado a `127.0.0.1:55433` (el contenedor) y la URL no contenía `supabase`, `pooler` ni el puerto 6543. No se usó `backend/.env` para la base: `DATABASE_URL` y `DIRECT_URL` se fijaron solo en la sesión |

**No es la misma máquina que EQ-04** (allí: i5-4590, 4 núcleos, 15,9 GB, PostgreSQL 16 en tmpfs). Por eso las cifras de este informe no son comparables punto a punto con el 381,4 ms del 05/11.

## 3. Resultados por tramo de VUs

Fuente: [`resumen.json`](resumen.json) y [`salida.txt`](salida.txt). Las solicitudes por segundo se calculan como solicitudes del tramo ÷ duración de la etapa (el `/s` de la salida de k6 divide entre los 600 s totales y **no** sirve por tramo).

| Tramo (VUs) | Duración | Solicitudes | Req/s | Mediana | p95 | p99 | Error HTTP | ¿p95 < 2 s? |
|---|---|---|---|---|---|---|---|---|
| 0 → 100 | 60 s | 2 572 | 42,9 | 46 ms | **778 ms** | 2 374 ms | 0 % | Sí |
| 100 → 500 | 120 s | 20 321 | 169,3 | 803 ms | **1 934 ms** | 2 353 ms | 0 % | Sí, por 66 ms |
| 500 → 1000 | 120 s | 20 412 | 170,1 | 3 492 ms | **6 213 ms** | 7 360 ms | 0 % | **No** |
| 1000 → 2000 | 120 s | 21 034 | 175,3 | 8 097 ms | **10 680 ms** | 11 207 ms | 0 % | **No** |
| 2000 sostenido | 120 s | 21 190 | 176,6 | 10 107 ms | **11 407 ms** | 11 990 ms | 0 % | **No** |
| 2000 → 0 | 60 s | 8 971 | 149,5 | 5 470 ms | **9 550 ms** | 9 774 ms | 0 % | **No** |
| **Total** | 600 s | 94 503 | 157,2 | 5 525 ms | **10 909 ms** | 11 594 ms | **0 %** (0 de 94 503) | **No** |

- 94 500 de 94 500 comprobaciones HTTP 200; máximo observado 12,2 s (no hubo `timeout`). Quedaron 15 iteraciones interrumpidas al bajar de 2000 VUs (comportamiento normal de `gracefulRampDown`).
- k6 terminó con código 99: los umbrales `http_req_duration` global y de los tramos 500–1000, 1000–2000, 2000 sostenido y 2000→0 se cruzaron. `http_req_failed` y los tramos 0–100 y 100–500 pasaron.
- El p95 del tramo 0→100 (778 ms) es mayor que el de EQ-04 con 100 VUs constantes (381,4 ms) porque incluye el arranque en frío (máximo 2,97 s) y la máquina es otra; no es una regresión demostrada.

## 4. ¿Cuándo empezó la degradación y qué se saturó?

**Rendimiento (throughput).** Se estancó en ≈ **170–177 req/s** desde ≈ 200–300 VUs (iteraciones completadas cada 30 s en `salida.txt`: ≈ 142 req/s a los 200 VUs y ≈ 175 req/s a partir de los 300). A partir de ahí, añadir VUs no sube el caudal: solo alarga la cola. Por eso la latencia crece casi linealmente con los VUs (mediana de 0,8 s con ≤ 500 VUs a 10,1 s con 2000) mientras los errores siguen en 0 %.

**Dónde dejó de cumplirse el umbral.** El tramo 100–500 todavía cumple (1 934 ms, al límite) y el 500–1000 ya no (6 213 ms). **El punto exacto dentro de ese rango no se determinó**: el resumen no da p95 por VU, solo por tramo. Como estimación **no medida** (ley de Little: 175 req/s × ≈ 1,8 s por ciclo ≈ 300 VUs), el límite del caudal está en torno a 300 VUs.

**Uso de recursos** (muestreo en [`muestreo-recursos.csv`](muestreo-recursos.csv); mediana de las muestras de cada tramo; CPU de Docker y del backend en % de **un** hilo lógico):

| Tramo | Backend CPU (mediana) | Base CPU (mediana / máx.) | k6 CPU (mediana) | RAM backend (máx.) | RAM k6 (máx.) |
|---|---|---|---|---|---|
| 0 → 100 | 35 % | 156 % / 202 % | 17 % | 229 MB | 398 MB |
| 100 → 500 | 77 % | 579 % / 690 % | 41 % | 389 MB | 557 MB |
| 500 → 1000 | 83 % | 652 % / 736 % | 43 % | 471 MB | 738 MB |
| 1000 → 2000 | 82 % | 574 % / 727 % | 43 % (un pico de 245 %) | 598 MB | 912 MB |
| 2000 sostenido | 85 % | 640 % / 654 % | 44 % | 664 MB | 1 019 MB |

**Probable cuello de botella: la base de datos, con el backend como segundo candidato; no concluyente.**
- La base pasó de ≈ 1,6 a ≈ 5,8–7 hilos al subir el caudal de 43 a 169 req/s y ya no subió más, igual que el caudal. Equivale a ≈ 34 ms de CPU de PostgreSQL por solicitud, frente a ≈ 4,5 ms del backend. Con un pool de 10 conexiones, la concurrencia hacia la base queda acotada.
- El backend (Node, un hilo principal) rondó el 77–85 % de un hilo, cerca de su límite; no se puede descartar que también limitara.
- **El generador no fue el límite:** k6 usó ≈ 43 % de un hilo (un pico aislado de 245 %) y ≈ 1 GB de RAM.
- **No determinado:** qué consulta es la costosa. No se registraron `pg_stat_statements` ni planes bajo carga. La búsqueda por texto (`ILIKE '%…%'`, sin índice de texto) y los dos recuentos (`findMany` + `count`) son sospechosos, pero **es una hipótesis, no un hallazgo** (véase [05 · Base de datos y caché](../../../../05-implementacion/05-base-de-datos-y-cache.md)).

**Errores del generador frente a los del servidor.** No hubo errores de ninguno de los dos: 0 solicitudes fallidas, sin `connection refused`, sin `cannot assign requested address` ni agotamiento de puertos. Los puertos en `TIME_WAIT` del host fueron ≤ 80 durante la carga y subieron a 2 019 solo en la muestra posterior (cierre de conexiones al terminar). La máquina no se congeló.

## 5. Limitaciones

1. **Máquina local, no producción.** k6, backend y PostgreSQL comparten CPU y RAM de un portátil; se compite por los mismos recursos y no hay latencia de red. **No es extrapolable a Render ni a Supabase** (otro hardware, red, pooler de conexiones y ajustes de PostgreSQL).
2. **Una sola ejecución.** No hay repetición ni dispersión entre corridas.
3. **Muestreo grueso de recursos.** `docker stats` en Windows tardó más al subir la carga: 34 muestras en ≈ 10 min (intervalos de ≈ 9 a 40 s). La alineación de las muestras con los tramos es aproximada (± 5–10 s). El contador de CPU total y de RAM libre del sistema (`Get-Counter`) **falló** por los nombres de contador en español y **no se capturó**; no se puede afirmar cuánto de la máquina estaba ocupado. El CSV original (con coma decimal, columnas desalineadas) se conserva en [`muestreo-recursos-crudo.csv`](muestreo-recursos-crudo.csv) y la versión normalizada es `muestreo-recursos.csv`.
4. **Cardinalidad de métricas.** k6 avisó de 100 011 series temporales (por las URL con identificadores distintos); no se observó efecto en los resultados, pero consumió memoria del generador.
5. **No comparable punto a punto con EQ-04:** hardware distinto, PostgreSQL 17 en volumen en lugar de 16 en tmpfs, y rampa en lugar de 100 VUs constantes.
6. **Solo lectura del catálogo.** No se midió el carrito, la reserva de stock ni la escritura bajo esta carga.
7. **Sin caché** en el backend (estado vigente del Sprint 02).

## Archivos

`resumen.json` (export de k6, incluye p95/p99 por tramo) · `salida.txt` (consola completa de k6) · `muestreo-recursos.csv` y `muestreo-recursos-crudo.csv` · script en [`ops/k6/catalogo-rampa.js`](../../../../../ops/k6/catalogo-rampa.js) · datos en [`ops/k6/datos/`](../../../../../ops/k6/datos/inventario-sintetico.sql).

Tras la prueba se eliminaron el contenedor `mercado-k6-db`, el contenedor `k6-rampa` y la imagen `grafana/k6`; las demás imágenes y contenedores no se tocaron.
