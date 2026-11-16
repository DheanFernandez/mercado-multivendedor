# 06 · Resultados, riesgos y limitaciones

> **Estado: plantilla.** Aún no hay resultados.

## 1. Resultados

| Fecha | Commit desplegado | Ambiente | Pruebas de humo | Mediciones | Evidencia |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

## 2. Riesgos conocidos antes del despliegue

| Riesgo | Efecto | Mitigación prevista |
|---|---|---|
| El módulo de Pagos no existe | El flujo de compra no puede completarse en producción; el Webhook no tiene destino | Desplegar primero lo implementado y declarar el alcance; Pagos en un incremento posterior (hito H5) |
| Pedidos no integrado en `main` | El despliegue de `main` no incluye pedidos | Integrar antes de desplegar, o declararlo como limitación |
| Un solo proceso de backend (ADR-001) | Un fallo no controlado detiene toda la API (riesgo R-08 del Sprint 02) | Reinicio automático del proveedor; meta de disponibilidad por definir |
| Exposición de secretos | Acceso indebido a la base de datos o a Storage | Gestor de secretos; `SUPABASE_SERVICE_ROLE_KEY` solo en el backend; rotación de claves |
| Migraciones aplicadas a producción por error | Pérdida o corrupción de datos | Autorización explícita y respaldo previo ([04](04-procedimiento-de-despliegue.md)) |
| Latencia entre el backend y Supabase | Peores resultados de EQ-04 que en la medición local | Elegir una región cercana; repetir EQ-04 en producción |
| Límites del plan de los proveedores | Rechazos o lentitud bajo carga | Revisar los límites antes de las pruebas de carga |

## 3. Limitaciones

Por completar tras el despliegue.
