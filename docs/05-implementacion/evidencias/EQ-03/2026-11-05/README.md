# EQ-03 · Concurrencia: reserva simultánea del mismo stock (AC07)

**Resultado: cumple.** 0 reservas incompatibles en el 100 % de las pruebas concurrentes (umbral documentado). Procedimiento tomado sin cambios de `03-matriz-de-mediciones.md` §EQ-03.

| Prueba | Carga | Resultado |
|---|---|---|
| Vitest, serie 1 | Stock físico 1; N = 2, 5 y 20 clientes distintos; 100 iteraciones por N (`Promise.all`) | 300/300 iteraciones con exactamente 1 éxito y N−1 faltas de stock controladas |
| Vitest, serie 2 | Stock S = 10; 200 clientes simultáneos; 100 iteraciones | 100/100 con exactamente 10 éxitos y 190 faltas controladas |
| k6 | 200 VUs durante 1 min (13 943 solicitudes), S = 10 | **Exactamente 10** reservas aceptadas, 13 933 faltas de stock (409), 0 respuestas inesperadas |
| SQL | `SELECT count(*) FROM inventarios WHERE stock_reservado > stock_fisico` | **0** (tras cada iteración, al final de Vitest y tras k6) |

Cero errores no controlados en las 400 iteraciones. El estado final tras k6 fue `stockFisico = 10, stockReservado = 10, reservas = 10`.

## Archivos
`eq03-vitest.json` (resumen por serie) · `salida-vitest.txt` · `eq03-k6.json` (métricas y umbrales) · `salida-k6.txt` · `entorno.txt` (versiones, máquina, migraciones, comandos de reproducción).

## Limitaciones declaradas
- Se mide `ReservarInventario`, la operación que invocará `CrearPedido`; `orders`/`cart` no existen. **Pendiente** repetir EQ-03 de punta a punta con `POST /pedidos`.
- k6 usa un arnés mínimo (`backend/src/scripts/servidor-eq03.ts`) que ejecuta las mismas clases de producción (caso de uso y repositorio PostgreSQL) y solo acepta la base local.
- PostgreSQL desechable de Docker en lugar de Testcontainers; una sola máquina que ejecuta k6, el arnés y la base de datos (no extrapolable). La latencia (p95 ≈ 1,2 s con 200 VUs sin tiempo de espera) no es un criterio de EQ-03 y no se interpreta.
