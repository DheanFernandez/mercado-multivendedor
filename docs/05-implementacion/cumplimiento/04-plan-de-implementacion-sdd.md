# Plan de implementación por módulos con SDD

> **Línea base congelada.** Cada especificación se apoya en `docs/01-analisis-de-sistema/`, los ADR y los diagramas C4 existentes; **no** introduce propuestas arquitectónicas adicionales. Si una especificación necesita algo que la línea base no define, lo registra como supuesto de ejecución.
> **Estado:** plan de trabajo. No se ha creado ninguna especificación ni se ha modificado código. Prioridades y tamaños en [02-pendientes-priorizados.md](02-pendientes-priorizados.md).

## 1. Flujo práctico por funcionalidad

**Especificar → Planificar → Generar tareas → Implementar → Probar → Medir → Revisar**

| Paso | Qué se hace | Comando o herramienta | Condición de salida |
|---|---|---|---|
| 1 Especificar | Redactar `specs/NNN-<módulo>/spec.md` con la sección *Trazabilidad* (HU, RF, ADR), criterios de aceptación y los EQ/AC que la miden. Resolver dudas en el mismo paso (Aclarar, máximo 5 preguntas) | `/speckit-specify`, `/speckit-clarify` | Sin marcadores de duda; cada criterio nombra su prueba |
| 2 Planificar | `plan.md`, `data-model.md` (migración **aditiva**) y `contracts/` según la estructura de capas de ADR-002 y los contratos de C4 nivel 3 | `/speckit-plan` | *Constitution Check* resuelto |
| 3 Generar tareas | `tasks.md` por historia, con tareas de prueba y de medición. Revisar coherencia entre spec, plan y tareas (Analizar, solo lectura) | `/speckit-tasks`, `/speckit-analyze` | Sin hallazgos críticos |
| 4 Implementar | Código por capas (`domain`, `application`, `infrastructure`, `entry-adapters`), migración aditiva sin ejecutar sobre la base compartida sin orden del equipo, pantallas | `/speckit-implement` | Tareas marcadas |
| 5 Probar | `build`, `lint`, `npm test`, `npm run test:e2e`; `npm run test:db` cuando toque la base; frontend `lint` y `build` | comandos del repositorio | Todo en verde con salida guardada |
| 6 Medir | Ejecutar las fichas EQ/AC de la [matriz de mediciones](03-matriz-de-mediciones.md) que correspondan al módulo, **solo en el entorno aislado** | k6, Vitest + Testcontainers, etc. | Carpeta de evidencia creada y comparación con el umbral |
| 7 Revisar | `/speckit-converge` contra el código real, actualizar la matriz de cumplimiento y registrar lo pendiente | revisión por pares | Matriz actualizada; sin cumplimiento declarado sin evidencia |

**Reglas de ejecución:** sin pruebas destructivas, de carga ni de concurrencia sobre la base compartida de Supabase; migraciones solo aditivas y por orden explícita; sin `commit`, `push` ni `merge` automáticos; el cumplimiento solo cambia en la matriz cuando existe evidencia archivada en `docs/05-implementacion/evidencias/`.

## 2. Plan por especificación

Cada fila es una especificación de `specs/`. Los números de RF/HU/EQ salen de la línea base.

### S-00 · Entorno de medición y CI *(transversal; antes de H0)*

| Campo | Contenido |
|---|---|
| Entregables | `ops/medicion/docker-compose.yml` (PostgreSQL 16 aislado), guarda contra la base compartida, plantilla de evidencias, dependencias de desarrollo (MSW, Testcontainers, Pino, `dependency-cruiser`, Faker), `.github/workflows/ci.yml` con compilación, lint y pruebas sin base de datos |
| Pruebas | El CI pasa en un pull request; la guarda aborta si `DATABASE_URL` apunta a Supabase |
| Medición | Prepara EQ-02, 03, 04, 07 |
| Depende de | Docker Desktop iniciado |

### S-01 · Cierre de administración *(H0)*

| Campo | Contenido |
|---|---|
| Trazabilidad | RF05, RF06, RF07; HU21, HU22; AC04, AC12 |
| Entregables | Editar comerciante y puesto; suspender/reactivar comerciante; desactivar/reactivar puesto y usuario; cambiar rol desde administración; paginación en servidor; pantallas |
| Datos | Sin tablas nuevas (campos `estado` y relaciones existentes) |
| Pruebas | Unitarias de casos de uso nuevos; HTTP con denegación por rol; interfaz con Playwright |
| Medición | **AC04**: prueba generada rol × ruta con informe JSON |
| Demostración | El administrador suspende a un comerciante y sus productos salen del catálogo |

### S-02 · Productos e imágenes: verificación real *(H0)*

| Campo | Contenido |
|---|---|
| Trazabilidad | RF09–RF11; HU12, HU13; RC09 |
| Entregables | Evidencia de `npm run storage:verificar` con la clave real; prueba de interfaz de alta de producto con imagen |
| Acción manual | Crear bucket público `productos` y definir `SUPABASE_SERVICE_ROLE_KEY` |
| Medición | Registro de la verificación en `evidencias/` (carga, lectura, no sobrescritura, rechazo de `anon`, eliminación) |

### S-03 · Catálogo y medición de rendimiento *(H0, completa en H2)*

| Campo | Contenido |
|---|---|
| Trazabilidad | RF16–RF19; HU01–HU03; AC01; EQ-04 |
| Entregables | Filtro por puesto en la interfaz; seed Prisma + Faker; script k6; disponibilidad en el detalle (cuando exista H2) |
| Pruebas | HTTP del filtro; unitarias existentes como regresión |
| Medición | **EQ-04**: 100 usuarios, p95 < 2 s, con k6 y Lighthouse en entorno aislado |
| Demostración | Informe de k6 con la comparación contra el umbral |

### S-04 · Configuración operativa y Auditoría mínima *(H1)*

| Campo | Contenido |
|---|---|
| Trazabilidad | RF45, RF42; HU24, HU26; AC06; DA10 |
| Entregables | Módulo `configuracion` (tiempos de reserva y expiración, tolerancias) y `auditoria` (puerto, tabla, consulta del administrador); registros estructurados con Pino; auditoría de las operaciones administrativas ya existentes |
| Datos | Tablas nuevas aditivas con RLS |
| Pruebas | Unitarias, HTTP (solo administrador), base de datos |
| Medición | Parte de AC06: registro del 100 % de eventos definidos |
| Demostración | El administrador cambia el tiempo de reserva y ve el evento en la auditoría |

### S-05 · Inventario *(H2)*

| Campo | Contenido |
|---|---|
| Trazabilidad | RF12–RF15, RF19, RF25; HU03, HU14, HU15; ADR-003; AC07; EQ-03 |
| Entregables | Modelo por producto y puesto; movimientos; `ReservarInventarioUseCase` como API pública (C4 nivel 4); reserva atómica condicional; liberación idempotente; expiración; pantallas del comerciante |
| Datos | Tablas nuevas aditivas; restricciones `CHECK` (reservado ≤ físico, no negativos) |
| Pruebas | Unitarias; HTTP; base de datos; **concurrencia** con Testcontainers |
| Medición | **EQ-03**: 300 iteraciones concurrentes y k6 con 200 usuarios virtuales |
| Demostración | Dos clientes compiten por el último producto: uno gana, el otro recibe «sin stock» |

### S-06 · Carrito multivendedor *(H3)*

| Campo | Contenido |
|---|---|
| Trazabilidad | RF20–RF24; HU04–HU06 |
| Entregables | Carrito y sus ítems; subtotales por puesto y total con importes exactos; reverificación de disponibilidad; pantallas |
| Pruebas | Unitarias de totales; HTTP (aislamiento por cliente); interfaz |
| Medición | — (alimenta EQ-05 y AC09) |
| Demostración | Carrito con tres puestos, subtotales y total |

### S-07 · Pedidos y subpedidos *(H4)*

| Campo | Contenido |
|---|---|
| Trazabilidad | RF25–RF31, RF36–RF39, RF46; HU07, HU09, HU10, HU16, HU18, HU19; ADR-003 §6.2 y §7; EQ-02; AC08 |
| Entregables | `CrearPedido` con idempotencia y unidad de trabajo (C4 nivel 4); `PedidoPuesto` y estados; historial; consulta del cliente y del comerciante por puesto; preparación, listo para retiro, entrega; variaciones con tolerancias de Configuración; pantallas |
| Datos | Tablas nuevas aditivas |
| Pruebas | Unitarias de la máquina de estados; HTTP; base de datos; fallo forzado con Testcontainers |
| Medición | **EQ-02** |
| Demostración | Pedido de tres puestos; un fallo de reserva no deja nada a medias; cada puesto prepara y entrega lo suyo |

### S-08 · Pagos, fase 1: cobro y confirmación *(H5)*

| Campo | Contenido |
|---|---|
| Trazabilidad | RF32–RF35, RF47–RF50, RF54; HU08, HU17; ADR-005; EQ-01, EQ-07, EQ-08; AC03, AC04, AC05, AC06, AC09 |
| Bloqueada por | DEC-01 y DEC-02 (ver K-1 en el documento de pendientes) |
| Entregables | `PasarelaPagoPort`; adaptador de Checkout Sandbox y adaptador local; entidad `Pago` con estados de ADR-005 §5.4; `IniciarPago`; Webhook con firma; consulta a la API; idempotencia y registro de notificaciones; conciliación periódica; expiración ligada a la reserva; evento `PagoAprobado` por Outbox; pantallas de pago |
| Datos | Tablas nuevas aditivas |
| Pruebas | Las 10 pruebas de ADR-005 §11 y las 8 de ADR-003 §10; contrato de `PasarelaPagoPort` |
| Medición | **EQ-01, EQ-07, EQ-08**, AC09 |
| Demostración | El cliente paga una vez; un Webhook falso no cambia nada; el aprobado habilita la preparación |

### S-09 · Pagos, fase 2: comisiones, reembolsos y vinculación *(H5)*

| Campo | Contenido |
|---|---|
| Trazabilidad | RF51–RF53, RF55; HU27–HU29 |
| Entregables | Comisión e importe neto por puesto; reembolsos totales y parciales; vinculación de la cuenta (modalidad según DEC-02); pantallas de cobros del comerciante |
| Pruebas | Unitarias (suma de netos = total − comisión, redondeo exacto); HTTP; Sandbox |
| Medición | Parte de AC04 (pagos): tokens, si existen, cifrados |

### S-10 · Trabajadores de puesto y tiendas *(H6)*

| Campo | Contenido |
|---|---|
| Trazabilidad | HU20, HU11, RF05, RF08 |
| Entregables | Asignación trabajador↔puesto con permisos; página pública del puesto |
| Pruebas | HTTP con aislamiento entre puestos |

### S-11 · Notificaciones, Incidencias y Reportes *(H6)*

| Campo | Contenido |
|---|---|
| Trazabilidad | RF41, RF40, RF43, RF44, RF46; HU16, HU23, HU25, HU29; DA11 |
| Entregables | Notificaciones desacopladas por eventos (el fallo no revierte la compra); incidencias con solicitud de reembolso; reportes del administrador y del comerciante |
| Medición | **EQ-06** (caída del servicio secundario) |

### S-12 · PWA, despliegue y cierre *(H7)*

| Campo | Contenido |
|---|---|
| Trazabilidad | RC01, RC20; AC02, AC09, AC10; EQ-05 |
| Entregables | Manifiesto y service worker; despliegue público; URL del Webhook; recorrido Playwright con puestos nuevos |
| Medición | **EQ-05**, AC09, Lighthouse |
| Cierre | Matriz de cumplimiento actualizada y paquete de evidencias |

## 3. Secuencia y dependencias

```text
S-00 ──► S-01 ─► S-02 ─► S-03 ──► S-04 ──► S-05 ──► S-06 ──► S-07 ──► S-08 ──► S-09 ──► S-10 ─► S-11 ─► S-12
 (Docker)  └────── H0 ──────┘     └ H1 ┘    └ H2 ┘    └ H3 ┘    └ H4 ┘    └────── H5 ──────┘    └─── H6 ───┘  └ H7 ┘
```

Se puede avanzar en paralelo: S-10 con S-05/S-06 (no dependen entre sí) y la interfaz de cada módulo con su caso de uso. S-08 solo comienza con DEC-01 y DEC-02 resueltas, pero **S-05, S-06 y S-07 no dependen de ellas**, de modo que las decisiones de pagos pueden tomarse mientras se construye el inventario.

## 4. Definición de terminado para cada especificación

1. Criterios de aceptación con prueba automatizada que pasa (unitaria, HTTP y, si aplica, base de datos).
2. Compilación y lint del backend y del frontend en verde, con la salida guardada.
3. Migración aditiva con RLS, revisada, y aplicada en el entorno aislado.
4. Fichas EQ/AC del módulo medidas y archivadas con su comparación con el umbral.
5. Matriz de cumplimiento actualizada; sin marcar «cumple» nada que no tenga evidencia.
6. Lo no verificado queda escrito como pendiente.

## 5. Riesgos principales

| Riesgo | Efecto | Mitigación |
|---|---|---|
| Docker Desktop no disponible | EQ-02 y EQ-03 no medibles | Verificarlo en S-00; alternativa: PostgreSQL local fuera de Supabase |
| Credenciales de Mercado Pago Sandbox o URL pública del Webhook tardan | Pagos bloqueados | Desarrollar con MSW y el adaptador local; reservar la verificación real para el final de S-08 |
| Decisiones DEC-01 y DEC-02 sin aprobar | S-08 y S-09 bloqueadas | Tomarlas durante S-05 a S-07 |
| Alcance: 41 RF pendientes | No terminar a tiempo | Seguir la ruta crítica (Inventario → Carrito → Pedidos → Pagos) y dejar PWA, reportes y notificaciones en versión mínima |
| Medir en una sola máquina | Resultados no extrapolables | Declarar la limitación en cada informe |
| Cambios sin confirmar en Git | Evidencia no reproducible | Registrar el hash y el estado del árbol en `entorno.txt` y confirmar al cerrar cada hito, por orden del equipo |

## 6. Primeras acciones

1. Iniciar Docker Desktop y comprobar que responde (`docker version`).
2. Definir `SUPABASE_SERVICE_ROLE_KEY` y crear el bucket público; ejecutar `npm run storage:verificar` y archivar el resultado.
3. Tomar las decisiones DEC-01, DEC-02, DEC-05 y DEC-09 en la medida mínima descrita en el documento de pendientes (§4.5).
4. Escribir S-00 y S-01 con `/speckit-specify` y arrancar H0.
