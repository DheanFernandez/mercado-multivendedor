# Matriz de Trazabilidad: RF → Driver → Decisión → Componente → Prueba

| Campo | Descripción |
|---|---|
| Proyecto | Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos |
| Entrega | Sprint 02 · IS-488 Arquitectura de Software · UNSCH 2026-II |
| Fecha | 16/11/2026 |
| Fuentes | [Requisitos e historias](../01-analisis-de-sistema/03-requisitos-funcionales.md), [drivers](../01-analisis-de-sistema/06-drivers-arquitectonicos.md), [ADR](../01-analisis-de-sistema/07-decisiones-arquitectonicas.md), [componentes](../02-arquitectura-software/componentes-arquitectonicos.md), [C4 nivel 3](../04-modelo-c4/Nivel3-Diagrama-de-Componentes.md), [escenarios](../01-analisis-de-sistema/08-escenarios-atributos-calidad.md), pruebas de `backend/` y [evidencias](../05-implementacion/evidencias/) |

Hasta ahora la trazabilidad existía por tramos, cada uno en un documento distinto: HU → RF, RF → módulo, driver → ADR y RF → prueba. Esta matriz los une en una sola cadena. El estado del código se verificó el 16/11/2026 contra `origin/main` (`1aab552`). **main** significa integrado en la rama principal publicada; **rama local** significa solo en `feat/pedidos-backend`, aún no publicada en GitHub. Las pruebas marcadas con † existen solo en esa rama local.

## 1. Trazabilidad por módulo

En la columna «Drivers», los drivers en **negrita** tienen esos RF en su columna de origen ([06-drivers](../01-analisis-de-sistema/06-drivers-arquitectonicos.md)). El resto aplica por el atributo de calidad o la restricción que lo origina. Las pruebas se citan por nombre de archivo, dentro de `backend/src/modules/<módulo>/` o de `backend/test/`.

| Módulo (documentación → código) | RF | HU | Drivers | Decisión | Componente C4 N3 | Escenario / atributo | Pruebas existentes | Estado del código |
|---|---|---|---|---|---|---|---|---|
| Autenticación y usuarios → `auth`, `users` | RF01–RF05 | HU20, HU21 | DA03, DA05 | ADR-001, ADR-002 | API REST; Autenticación y usuarios | AC04 (matriz rol × ruta), AC12 | `jose-verificador-token.spec`, `autenticar-solicitud.use-case.spec`, `usuarios.use-cases.spec`, `gestion-usuarios.use-cases.spec`, `supabase-identidad.adapter.spec`; `autenticacion.e2e-spec`, `administracion.e2e-spec`, `matriz-autorizacion.e2e-spec` | Implementado (main). Permisos por puesto pendientes (DEC-09) |
| Comerciantes y puestos → `merchants` | RF06–RF08, RF52 | HU11, HU22, HU27 | DA03, DA04 | ADR-001; ADR-005 §5.6 | Comerciantes y puestos | EQ-05 (AC02), AC12 | `merchants.use-cases.spec`, `gestion-merchants.use-cases.spec`; `h0-administracion.e2e-spec`; `h0-persistencia.db-spec` | RF06 y RF07 implementados (main). RF08 (DEC-10) y RF52 (DEC-02) pendientes |
| Productos y categorías → `products` | RF09–RF11 | HU12, HU13 | DA04, DA12 | ADR-001, ADR-002 | Productos y categorías | AC04, AC08 | `dominio.spec`, `productos.use-cases.spec`; `productos.e2e-spec`; `productos-persistencia.db-spec`, `modelo-restricciones.db-spec` | Implementado (main) |
| Inventario → `inventory` | RF12–RF15, RF25 | HU14, HU15 | **DA02**, DA01 | ADR-003 | Inventario | **EQ-03** (AC07), EQ-02 (AC08) | `stock.spec`, `inventario.use-cases.spec`, `index.spec`†; `inventario.e2e-spec`; `inventario.db-spec`, `inventario-invariantes.db-spec`, `inventario-unidad-de-trabajo.db-spec`†, `eq03-concurrencia.db-spec`; `ops/k6/eq03-reserva.js` | Implementado (main). La unión a la unidad de trabajo está en la rama local |
| Marketplace y catálogo → `catalog` | RF16–RF19 | HU01–HU03 | DA01 | ADR-001 | Catálogo | **EQ-04** (AC01) | `catalogo.use-cases.spec`, `catalogo-detalles.use-cases.spec`†; `catalogo-detalles.db-spec`†; `ops/k6/catalogo.js` | Implementado (main). Deuda C-05: lee tablas de `products` y `merchants` |
| Carrito multivendedor → `cart` | RF20–RF24 | HU04–HU06 | **DA07** | ADR-001, ADR-003 | Carrito | AC08 | `calculo.spec`, `carrito.use-cases.spec`, `pedido.use-cases.spec`†; `carrito.e2e-spec`; `carrito.db-spec`, `carrito-para-pedido.db-spec`†, `carrito-unidad-de-trabajo.db-spec`† | Implementado (main). La API para Pedidos está en la rama local |
| Pedidos → `orders` | RF26–RF31, RF36–RF39 | HU07, HU09, HU10, HU18, HU19 | **DA07**, DA02, DA09, DA14 | ADR-003; ADR-005 §5.4 | Pedidos | **EQ-02** (AC08), EQ-03 (AC07) | Todas en la rama local†: `pedido.entity.spec`, `codigo-pedido.spec`, `estado-subpedido.spec`, `estado-general.spec`, `huella-carrito.spec`, `pedido-reconstitucion.spec`, `importes.spec`, `crear-pedido.use-cases.spec`; `pedidos-esquema.db-spec`, `pedidos-repositorio.db-spec`, `unidad-de-trabajo.db-spec` | En `main`, módulo vacío. En la rama local, en desarrollo: 13 de 30 tareas de `specs/003`, sin rutas HTTP. RF36–RF39 quedan fuera de esa especificación |
| Pagos → `payments` | RF32–RF35, RF47–RF51, RF53–RF55 | HU08, HU17, HU28, HU29 | **DA08**, **DA09**, DA03, DA10, DA11 | ADR-005 (borrador de ADR-006, no aceptado) | Pagos; Webhook de pagos | **EQ-01**, **EQ-07**, **EQ-08**; AC09 | Ninguna | Sin implementar (módulo vacío) |
| Incidencias | RF40 | HU23, HU29 | DA11 | ADR-005 (reembolsos) | Incidencias | — | Ninguna | Inexistente |
| Notificaciones | RF41 | Ninguna (RF41 sin HU, pendiente ya registrado) | DA11 | ADR-002 | Notificaciones | **EQ-06** (AC03, AC11) | Ninguna | Inexistente |
| Auditoría | RF42 | HU26 | **DA10** | ADR-005 §7 (solo pagos) | Auditoría | AC06, EQ-08 | Ninguna | Inexistente (C-13, DEC-05) |
| Reportes | RF43, RF44, RF46 | HU16, HU23, HU25 | — | ADR-001 | Reportes | — | Ninguna | Inexistente |
| Configuración operativa | RF45 | HU24 | DA02 (tiempos de reserva) | ADR-003 §6.5 | Configuración operativa | EQ-08 (vigencia de la reserva) | Ninguna | Inexistente |

## 2. Cadena completa de los requisitos críticos

Se detallan los RF que alimentan los drivers prioritarios (DA02, DA03, DA07, DA08, DA09, DA10) y los escenarios EQ. La columna «Evidencia y resultado» solo cita pruebas ejecutadas con resultado conocido.

| RF | Driver | Decisión (sección) | Componente o clase | Escenario | Prueba | Evidencia y resultado |
|---|---|---|---|---|---|---|
| RF03, RF04 (rol y funciones por rol) | DA03 | ADR-002 §8; constitución V | `auth.guard.ts` y tabla de permisos | AC04 | `matriz-autorizacion.e2e-spec.ts` | 252/252 conformes ([16/11](evidencias/2026-11-16/README.md)); 198/198 ([05/11](../05-implementacion/evidencias/AC04/2026-11-05/README.md)) |
| RF15 (no confirmar más que el disponible) | DA02 | ADR-003 §6.3 | `PrismaInventarioRepository.reservar` (UPDATE condicional) | EQ-03 | `eq03-concurrencia.db-spec.ts`; `ops/k6/eq03-reserva.js` | 400/400; 10 reservas exactas con 200 usuarios virtuales ([05/11](../05-implementacion/evidencias/EQ-03/2026-11-05/README.md)). Satisfecho con reservas |
| RF16–RF18 (catálogo, búsqueda y filtros) | DA01 | ADR-001 | `PrismaCatalogoRepository` | EQ-04 | `ops/k6/catalogo.js` | p95 = 381,4 ms con 100 usuarios virtuales ([05/11](../05-implementacion/evidencias/EQ-04/2026-11-05/README.md)). Satisfecho con reservas |
| RF25 (reverificar y reservar al confirmar) | DA02, DA07 | ADR-003 §6.2 | `CrearPedido` + `ReservarInventario` en la unidad de trabajo | EQ-02, EQ-03 | `crear-pedido.use-cases.spec.ts`† (bloque EQ-02); `inventario-unidad-de-trabajo.db-spec.ts`† | 7/7 casos de fallo forzado con dobles en memoria ([16/11](evidencias/2026-11-16/README.md)). La prueba sobre PostgreSQL no se ejecutó en esta evaluación |
| RF26, RF29 (pedido de varios puestos, agrupado) | DA07 | ADR-003 §6.2; C4 N4 | `Pedido`, `Subpedido`, `PrismaPedidoRepository` | EQ-02 | `pedido.entity.spec.ts`†; `pedidos-repositorio.db-spec.ts`† | Pruebas unitarias en verde (rama local). Medición EQ-02 pendiente (T016, T026) |
| RF35 (preparar solo con el pago aprobado) | DA09 | ADR-005 §5.4 | `EstadoSubpedido`: `EN_PREPARACION` solo es alcanzable desde `PAGO_APROBADO` | EQ-01 | `estado-subpedido.spec.ts`† | La regla de dominio pasa en las pruebas unitarias (rama local). Nada lleva hoy un pedido a `PAGO_APROBADO` porque Pagos no existe |
| RF48 (Webhook con firma y consulta a la API) | DA03, DA08 | ADR-005 §5.3 | Webhook de pagos; `VerificadorFirmaMercadoPago` | EQ-01 | Prevista: `test/eq01-webhook.e2e-spec.ts` (8 casos) | No existe |
| RF49 (Webhook idempotente) | DA08, DA11 | ADR-005 §5.3 (4) | `ProcesarNotificacionPago` | EQ-08 | Prevista (Vitest + Supertest) | No existe |
| RF50 (conciliación periódica) | DA11 | ADR-005 §10 | Pagos | EQ-08 | Prevista (MSW o Toxiproxy) | No existe |
| RF54 (vencimiento del pago ligado a la reserva) | DA11 | ADR-003 §6.5; ADR-005 | Inventario (expirar) + Pagos | EQ-08 | `inventario-invariantes.db-spec.ts` (incluye expiración) | Expiración de reservas implementada; la parte del pago no existe. No se ejecutó en esta evaluación |
| RF42 (auditoría de operaciones críticas) | DA10 | ADR-005 §7 (7) | Auditoría | AC06 | — | No existe |
| RF47 + puerto de pasarela | DA08, DA12 | ADR-005 §5.5; ADR-002 | `PasarelaPagoPort` + adaptadores | EQ-07 | `backend/.dependency-cruiser.cjs` (regla del SDK) | La regla pasa porque el SDK no está instalado ([16/11](evidencias/2026-11-16/README.md)) |

## 3. Huecos de trazabilidad

| Hueco | Detalle | Tratamiento sugerido (sin modificar la línea base) |
|---|---|---|
| RF sin driver directo | Solo 12 RF figuran en el origen de un driver (RF12, RF14, RF15, RF20, RF21, RF26, RF29, RF32–RF35 y RF42). Los otros 43 se vinculan a la arquitectura por su módulo (DA04, DA12) | Es normal que no todo RF sea arquitectónicamente significativo. Basta declararlo así en la exposición |
| RF41 sin historia de usuario | Ya registrado en [componentes §5](../02-arquitectura-software/componentes-arquitectonicos.md#5-verificación-de-coherencia-documental) | Decisión del equipo (DEC-12) |
| Atributos sin escenario EQ | AC09 (tiene criterio, pero no escenario), AC10 y AC12; AC06 solo aparece dentro de EQ-08 | Ninguno es prioritario. Se pueden añadir escenarios en un cambio aprobado de `docs/01` |
| Cadena de pagos sin pruebas | RF32–RF35 y RF47–RF55 terminan en «prevista» | Hito H5, tras DEC-01 y DEC-02 |
| Nombres distintos en documentación y código | `usuarios` → `auth` + `users`, `pagos` → `payments`, etc. (C-08, C-09) | Tabla de equivalencias de la constitución, aún no publicada (DEC-06, DEC-11); esta matriz usa ambos nombres |
