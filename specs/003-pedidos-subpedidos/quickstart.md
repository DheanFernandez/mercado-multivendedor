# Guía de validación: Pedidos y subpedidos

Prerrequisitos (solo para cuando exista implementación): Node 24, `npm ci` en `backend/`, Docker Desktop iniciado para el PostgreSQL local aislado. **No hay código que ejecutar todavía**: esta guía fija cómo se validará y qué resultado se espera.

## Verificación automática (desde `backend/`)

| Paso | Comando | Resultado esperado |
|---|---|---|
| **Compuerta** | `npx vitest run --config ./vitest.config.db.ts test/poc-unidad-de-trabajo.db-spec.ts` | **POC-001 en verde** antes de cualquier otra implementación |
| Esquema | `npx prisma validate` | válido |
| Unitarias | `npm test` | verdes, incluidas máquina de estados, estado general, código, importes y casos de uso con fallos forzados |
| HTTP | `npm run test:e2e` | verdes, incluida la matriz de autorización con las 4 rutas nuevas |
| PostgreSQL | `npm run test:db` | verdes: restricciones, **EQ-02** (fallo inyectado en cada paso), concurrencia (**EQ-03**, misma clave, claves distintas sobre el mismo carrito, edición concurrente del carrito, interbloqueo), unidad de trabajo y propagación |
| Arquitectura | `npm run arquitectura` | sin violaciones ni ciclos (`orders → cart, inventory` solo por `index.ts`) |
| Calidad | `npm run lint` y `npm run build` | sin errores |
| Regresión | suites existentes de Inventario y Carrito dentro de las anteriores | sin cambios de resultado |

## Escenarios de aceptación (resumen)

1. Carrito de 3 puestos con stock → 201, 3 subpedidos `ESPERANDO_PAGO`, total = suma de subtotales, carrito vacío, stock reservado exacto (CA-O1–O6, O23).
2. Un producto sin stock → 409 que nombra el producto; 0 pedidos, 0 reservas nuevas, carrito intacto (CA-O7, EQ-02).
3. Repetir la solicitud con la misma clave → 200 y el mismo pedido, sin reservar de nuevo, aunque el carrito esté vacío o distinto; 20 en paralelo → 1 pedido (CA-O10–O12).
4. Editar el carrito mientras se crea el pedido → cada línea queda en el pedido o en el carrito, nunca perdida ni duplicada (CA-O23); dos claves distintas sobre el mismo carrito, o un cliente sin carrito → una convierte y la otra recibe «carrito vacío» (CA-O28).
5. Sin `PEDIDOS_RESERVA_MINUTOS` → 503 y nada creado; con ella, `reservaVenceEn` futuro (CA-O24).
6. Consultar el pedido: `estadoGeneral` común o `MIXTO`; otro cliente → 404; historial con el registro inicial (CA-O14–O19, O25).

## Configuración para las pruebas

`PEDIDOS_RESERVA_MINUTOS` (entero de 1 a 99 999 999) se define **solo** en el entorno de pruebas (variable del proceso o `.env` local ignorado por Git); el repositorio no fija ningún valor. Las pruebas de base de datos usan la guarda `base-aislada` y limpian sus datos con `session_replication_role = replica` solo sobre filas etiquetadas.

## Mediciones posteriores a la implementación

- **EQ-02**: informe de fallos forzados con consultas SQL antes/después (0 pedidos, subpedidos o reservas inconsistentes).
- **EQ-03 sobre «crear pedido»**: repetir la medición k6 de reserva con el flujo completo; comparar con la línea base de `ReservarInventario` (400/400 iteraciones y 10 reservas con 200 usuarios virtuales).

Lo que no se ejecute se informará como no ejecutado.
