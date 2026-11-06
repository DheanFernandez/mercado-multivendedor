<!--
SYNC IMPACT REPORT
Versión: 1.1.0 → 1.1.1  [PATCH: corrección factual de la deuda arquitectónica: 6 importaciones internas ajenas, no 4]
Versión: 1.0.0 → 1.1.0  [MINOR: secciones nuevas y ampliación material; ningún principio eliminado]
Modificado en 1.1.0 (solo aspectos no controvertidos):
  - VI Pagos: la "Decisión D-001" deja de ser una decisión; se sustituye por la definición de cuatro conceptos y un bloqueo
    hasta que el equipo apruebe DEC-01/DEC-02 (no se da por aprobada la distribución simulada).
  - IX Calidad: la prueba de integración se alinea con EQ-02/03/08 (PostgreSQL desechable) y se limita la concurrencia sobre datos reales.
  - Agregadas: equivalencia de nombres docs↔código, deuda arquitectónica reconocida, estado de los ADR (ADR-004 reemplazado)
    y referencia a las decisiones pendientes DEC-01..DEC-12.
  - Ratificación: pasa a TODO(RATIFICATION_DATE) hasta que el equipo apruebe.
Historial: 1.0.0 (2026-11-05) versión inicial.
Principios agregados en 1.0.0: I–X. Secciones: Estado de los módulos, Flujo de desarrollo obligatorio (SDD), Alcance excluido, Governance.
Plantillas:
  ✅ .specify/templates/plan-template.md   — "Constitution Check" con compuertas I–X y encabezado de trazabilidad
  ✅ .specify/templates/spec-template.md   — sección obligatoria "Trazabilidad" (HU, RF, ADR, RC/AC/DA, criterios)
  ✅ .specify/templates/tasks-template.md  — pruebas obligatorias, fase de Análisis/Revisión, sin commits automáticos
  ⚠ .specify/templates/checklist-template.md — sin cambios (genérica); revisar al usar /speckit-checklist
  ⚠ .specify/workflows/speckit/workflow.yml  — ejecuta specify → plan → tasks → implement; NO incluye clarify ni analyze
    ni compuertas de pruebas/revisión. Pendiente de decisión del equipo (ver "Flujo de desarrollo obligatorio").
TODOs diferidos:
  - TODO(RATIFICATION_DATE): fecha de aprobación por el equipo.
  - TODO(DEC-01/DEC-02): modelo de distribución y de vinculación de cuentas de Mercado Pago; requiere ADR antes de especificar `payments`.
  - TODO(DEC-04): marcar los ADR-001, 002, 003 y 005 como "Aceptada" cuando el equipo lo confirme.
  - TODO(DEC-08): el workflow `.specify/workflows/speckit/workflow.yml` no incluye las 8 etapas; hay un borrador en el documento de revisión.
-->

# Constitución del Proyecto: Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos

Esta constitución rige todo el ciclo de desarrollo mediante Spec-Driven Development (SDD) con GitHub Spec Kit.
Resume y hace exigibles las decisiones ya documentadas en `docs/` (restricciones RC, atributos de calidad AC,
drivers DA y ADR-001 a ADR-005). **No sustituye ni reescribe esos documentos**: ante cualquier conflicto prevalece
`docs/` y la diferencia se resuelve según la sección Governance.

## Principios fundamentales

### I. Monolito modular (NON-NEGOTIABLE)

El backend es **una única aplicación NestJS desplegable**, dividida en módulos por dominio (ADR-001; RC11, RC12; DA14).

- MUST NOT introducirse microservicios, colas externas ni bases de datos por módulo sin un ADR que reemplace al ADR-001.
- Los módulos MUST comunicarse solo mediante contratos públicos (casos de uso exportados o puertos); MUST NOT importar
  archivos internos de otro módulo (`domain/`, `infrastructure/`, controladores) ni formar dependencias circulares.
- Los módulos previstos son los listados en ADR-001; un módulo nuevo MUST registrarse en `app.module.ts` y en la tabla
  "Estado de los módulos" de esta constitución.
- El frontend es un contenedor separado que consume la API REST (RC06); no forma parte de los anillos del backend.
- Las operaciones críticas entre módulos MUST ser transaccionales sobre la misma base de datos (AC08).

*Verificación:* el plan nombra el módulo propietario y los contratos con otros módulos; la revisión busca importaciones
cruzadas.

### II. Clean Architecture por módulo (NON-NEGOTIABLE)

Cada módulo de negocio se organiza en `domain/`, `application/`, `infrastructure/` y `entry-adapters/` (ADR-002;
diseño interno de módulos).

- `domain/` y `application/` MUST NOT importar NestJS, Prisma, Supabase, `pg`, `jose`, SDK de pasarelas ni el cliente generado.
- Los casos de uso MUST recibir sus dependencias como puertos (interfaces) por constructor; los repositorios y
  adaptadores concretos viven en `infrastructure/`.
- Los controladores (`entry-adapters/`) MUST limitarse a traducir HTTP ↔ casos de uso: sin reglas de negocio ni consultas.
- La composición de dependencias MUST hacerse en el `*.module.ts` del módulo.
- Las reglas de negocio y de **autorización por rol y por propiedad** MUST residir en dominio o casos de uso.
- Los errores de negocio MUST ser errores de dominio independientes de HTTP; un filtro único los traduce a respuestas.

### III. Frontend: Next.js, React y TypeScript

- La interfaz MUST usar Next.js 16 (App Router), React y TypeScript estricto, con Tailwind CSS (RC01–RC03; DA13).
- El frontend MUST consumir únicamente la API REST `/api/v1`; MUST NOT acceder directamente a la base de datos ni a
  Storage con credenciales privilegiadas.
- La interfaz es responsive (AC09, AC10); la preparación como PWA (RC01) se planifica en su propia especificación.
- Ocultar opciones en la interfaz según el rol es solo experiencia de usuario (RF04); **nunca** es un control de seguridad.
- Los importes se muestran como texto exacto entregado por la API; MUST NOT calcularse totales monetarios con `number` flotante.
- Solo variables `NEXT_PUBLIC_*` con valores públicos pueden llegar al navegador.

### IV. Persistencia: Prisma y PostgreSQL (Supabase)

- Todo acceso a datos MUST pasar por repositorios de `infrastructure/` que usan Prisma 7 con `@prisma/adapter-pg` (RC07, RC08; DA06).
- Los cambios de esquema MUST hacerse mediante migraciones versionadas, **aditivas y revisadas antes de aplicarse**;
  MUST NOT ejecutarse migraciones destructivas, `migrate reset` ni `db push` contra la base compartida.
- Toda tabla nueva MUST tener RLS habilitado sin políticas públicas (el backend usa el rol `postgres`) y las
  restricciones `CHECK`, claves foráneas (`RESTRICT` por defecto) e índices que sus reglas requieran.
- Los importes MUST almacenarse como `NUMERIC` exacto y operarse en céntimos enteros; MUST NOT usarse `float`/`double`.
- Un recurso con historia (productos, pedidos, pagos) MUST desactivarse, no eliminarse.
- Las pruebas de base de datos MUST ejecutarse solo contra la base de desarrollo y MUST revertir o eliminar los datos que crean.

### V. Autenticación y autorización

- La **autenticación** es de Supabase Auth; el backend MUST verificar cada JWT (firma, emisor, audiencia, expiración).
- Los **roles y permisos** MUST leerse siempre de PostgreSQL (`usuarios`); MUST NOT tomarse del token, de cabeceras, del
  cuerpo de la solicitud ni del frontend.
- Las rutas MUST ser privadas por defecto; las públicas se marcan explícitamente (`@Public()`) y se justifican en la especificación.
- El autorregistro MUST crear únicamente `CLIENTE`. Ninguna ruta permite a un usuario cambiar su propio rol; el primer
  administrador se promueve mediante el script de administración con acceso a la base.
- Toda operación nueva MUST declarar en su especificación qué roles pueden ejecutarla y MUST tener pruebas de denegación (401/403).

### VI. Pagos: pago único con Mercado Pago Sandbox (ADR-005)

- El cliente MUST pagar **una sola vez por pedido**; el importe es la suma de los subtotales por puesto (RC13; RF32, RF47).
- Solo se usa el **entorno Sandbox** de Mercado Pago. MUST NOT usarse credenciales productivas ni realizarse cobros reales
  hasta que exista una decisión posterior documentada (ADR-005 §6).
- El estado de un pago MUST determinarse únicamente por el Webhook **con firma verificada** y la **consulta a la API** de
  la pasarela; MUST NOT confiar en el contenido de la notificación ni en la redirección del cliente (RF48).
- El procesamiento MUST ser **idempotente** (RF49), con registro de cada notificación (AC06) y conciliación periódica (RF50).
- Ningún usuario valida pagos manualmente (RF34). Los productos de un puesto MUST NOT pasar a preparación sin pago `APROBADO` (RF35).
- Ningún módulo salvo `payments` depende del SDK o la API de Mercado Pago: se accede mediante `PasarelaPagoPort` y adaptadores.
- **Cuatro conceptos que MUST NOT confundirse.** Toda especificación, plan y prueba del módulo `payments` MUST declarar
  cuál de ellos trata y usar estos términos con este significado:
  1. *Pago único del cliente*: un cobro por pedido (suma de subtotales) mediante Mercado Pago Checkout Sandbox (RC13).
  2. *Vinculación de cuentas de comerciantes*: autorización de la cuenta de Mercado Pago de cada comerciante (RC14, RF52, HU27).
  3. *Distribución financiera real*: movimiento real de dinero hacia las cuentas de los comerciantes (Split o liquidación posterior; ADR-005 §4, respaldo).
  4. *Distribución contable simulada*: registro interno por puesto de subtotal, comisión e importe neto, sin movimiento de dinero (propuesta, no aprobada).
- **Bloqueo:** el modelo de distribución y de vinculación (conceptos 2 a 4) está **pendiente de aprobación del equipo**
  (DEC-01 y DEC-02 en `docs/06-gobernanza-sdd/01-revision-de-consistencia.md`). Hasta que se aprueben y se documenten en un ADR, la
  especificación de `payments` MUST NOT darlos por resueltos ni iniciarse más allá de la Aclaración. Si se aprueba una
  distribución simulada, sus registros MUST rotularse `simulado` en datos e interfaz y MUST NOT presentarse como liquidación real.
- No se almacenan datos de tarjeta; los tokens de comerciantes, si llegaran a guardarse, MUST cifrarse (AC04).

### VII. Inventario: reservas atómicas y concurrencia (ADR-003)

- El inventario se administra por producto y puesto, distinguiendo stock físico, reservado y disponible (RF14).
- Toda reserva MUST ser una **operación atómica y condicional en PostgreSQL** dentro de una transacción corta
  (p. ej. `UPDATE … WHERE stock_fisico - stock_reservado >= :cantidad`); MUST NOT confirmarse más stock del disponible (RF15).
- La validación en el frontend o en memoria del proceso MUST NOT considerarse un control de consistencia.
- Crear pedidos y reservar MUST ser idempotente ante reintentos (identificador único de operación).
- La liberación de reservas MUST ser idempotente, y la expiración y el Webhook sobre un mismo pedido MUST serializarse (ADR-003 §6.5).
- Los tiempos de reserva son configurables (RF45), no constantes en código.
- Todo cambio de inventario MUST tener pruebas de concurrencia (dos clientes sobre el último stock, fallo a mitad de transacción, reintento).

### VIII. Seguridad y protección entre comerciantes

- **Secretos fuera de Git:** `.env` y credenciales MUST NOT versionarse; `.env.example` contiene solo marcadores. La clave de
  servicio de Supabase y los secretos de Mercado Pago MUST existir solo en el backend y MUST NOT aparecer en logs,
  mensajes de error, respuestas ni el navegador.
- **Autorización en el backend** (AC04): cada operación se autoriza en el caso de uso, no solo en la interfaz.
- **Aislamiento entre comerciantes** (AC12): un comerciante MUST poder leer y modificar únicamente recursos de sus propios
  puestos. Toda funcionalidad que opere sobre recursos de un puesto MUST incluir pruebas de acceso cruzado (comerciante B
  sobre recursos de A) y de rol no autorizado.
- Las entradas MUST validarse en dominio/aplicación (formato, rangos, longitudes); las cargas de archivos se validan por
  su contenido real, tamaño y tipo.
- Los errores de integraciones externas se traducen a respuestas controladas sin filtrar detalles internos (DA11).
- Las operaciones críticas MUST registrarse para auditoría (RF42; AC06) cuando exista el módulo Auditoría; hasta entonces
  la especificación MUST declarar qué operaciones quedan sin auditar.

### IX. Calidad: pruebas y verificación

Ninguna funcionalidad se considera terminada sin evidencia ejecutada de:

1. **Pruebas unitarias** de dominio y casos de uso (sin red ni base de datos).
2. **Pruebas HTTP** con la aplicación completa, repositorios en memoria y verificador de tokens simulado
   (incluye autenticación, autorización y validación).
3. **Pruebas de integración/persistencia** contra PostgreSQL para restricciones del modelo y repositorios. Los escenarios
   EQ-02, EQ-03 y EQ-08 proponen PostgreSQL desechable (Testcontainers); mientras no exista se usa la base de desarrollo,
   con datos etiquetados que se eliminan al terminar y **sin** pruebas de concurrencia que bloqueen datos reales. Las
   pruebas de concurrencia de Inventario MUST esperar a contar con una base desechable (decisión DEC-07).
4. **Compilación** (`npm run build` en backend y frontend) y **lint** sin errores; `prisma validate` si cambia el esquema.

- Las pruebas se escriben **antes o junto con** la implementación; los criterios de aceptación de la especificación MUST
  corresponder a pruebas concretas.
- MUST NOT informarse como superado lo que no se ejecutó; se informan resultados reales y lo que quedó sin probar.
- Las pruebas propuestas en ADR-003 §10 y ADR-005 §11 son el mínimo obligatorio de sus módulos.
- Los atributos de calidad prioritarios (seguridad, integridad, concurrencia, rendimiento) MUST tener un escenario
  verificable en la especificación (AC01–AC12).

### X. Trazabilidad

- Toda especificación MUST incluir la sección **Trazabilidad** con: historias de usuario (HU), requisitos funcionales (RF),
  ADR, restricciones/atributos/drivers (RC, AC, DA) y los **criterios de aceptación** que los verifican.
- Los identificadores citados MUST existir en `docs/01-analisis-de-sistema/`. Los requisitos **no se reescriben**: si la
  documentación es ambigua, está incompleta o contradice el código, la especificación lo registra como *Aclaración* o
  *Decisión de especificación* con su justificación, y propone la enmienda a `docs/` por separado.
- Todo plan, tarea y prueba MUST poder rastrearse hasta un RF/HU; el análisis (`/speckit-analyze`) verifica la cobertura.
- Lo implementado queda documentado en `docs/05-implementacion/`; los README solo describen lo implementado y verificable.

## Estado de los módulos

Fuente: código y pruebas del repositorio al 2026-11-05. Un módulo cambia de estado solo con evidencia (código, pruebas, documento).

### Implementados (con código, pruebas y `docs/05-implementacion/`)

| Módulo | Cubre | Notas |
|---|---|---|
| `auth` | RF02, RF03; HU20 (parcial) | Supabase Auth + JWT; guard global |
| `users` | RF01, RF03, RF05 (parcial); HU21 | Rol único por usuario (enum); sin tabla de permisos |
| `merchants` | RF06, RF07; HU22 | Comerciantes y puestos. No incluye tiendas virtuales (RF08) |
| `products` | RF09–RF11; HU12, HU13 | Categorías gestionadas por el administrador; imágenes con Supabase Storage (verificación real pendiente de credenciales) |
| `catalog` | RF16–RF19 (parcial); HU01–HU03 | RF19 sin disponibilidad: depende de Inventario |
| `inventory` | RF12–RF15; HU14, HU15 (backend) | `specs/001-inventario`. Sin pantalla; reserva expuesta como API interna (no hay `orders`). Expiración y aprobación tardía (ADR-003 §6.5) pendientes de `payments` y Configuración |
| Interfaz | RF04 | Catálogo, cuenta, panel del comerciante y administración |

### Pendientes (módulo vacío o inexistente)

| Módulo | Requisitos | Observación |
|---|---|---|
| `cart` | RF20–RF24; HU04–HU06 | Vacío |
| `orders` | RF26–RF31, RF36–RF39, RF46; HU07, HU09, HU10, HU16, HU18, HU19 | Vacío |
| `payments` | RF32–RF35, RF47–RF55; HU08, HU17, HU27–HU29 | Vacío. ADR-005 y Decisión D-001 |
| Configuración operativa | RF45; HU24 | No existe; **prerrequisito** de Inventario y Pagos (tiempos de reserva y expiración) |
| Tiendas virtuales | RF08, RF52; HU11 | No existe |
| Trabajadores de puesto | HU20 | El rol existe sin atribuciones ni modelo de asignación por puesto |
| Incidencias, Notificaciones, Auditoría, Reportes | RF40, RF41, RF42, RF43–RF44; HU23, HU25, HU26 | No existen |

**Regla de regularización:** los módulos implementados no tienen especificación de Spec Kit. Antes de **modificar** uno de
ellos se crea una especificación de regularización que cite lo ya documentado en `docs/05-implementacion/` y el código
existente; los módulos pendientes siguen el flujo completo desde cero.

### Equivalencia entre los nombres de `docs/` y del código

`docs/` nombra las carpetas en español (`src/modules/usuarios/`); el código usa inglés. Hasta que el equipo decida
otra cosa (DEC-06) se conserva la convención del código y esta equivalencia es la referencia de trazabilidad:

| Documentación (C4 nivel 3) | Código | Documentación | Código |
|---|---|---|---|
| `usuarios` (Autenticación y usuarios) | `users` + `auth` | `inventario` | `inventory` |
| `comerciantes` | `merchants` | `carrito` | `cart` |
| `productos` | `products` | `pedidos` | `orders` |
| `catalogo` | `catalog` | `pagos` | `payments` |
| `configuracion`, `incidencias`, `notificaciones`, `auditoria`, `reportes` | aún sin crear | `shared/http` | `shared/http` |

### Deuda arquitectónica reconocida (no autoriza nuevas violaciones)

Existen incumplimientos del principio I detectados el 2026-11-05 (detalle en la matriz C-05 a C-07 del documento de
revisión): `catalog` lee tablas de `products` y `merchants`; `auth` importa internos de `users` (cuatro archivos, incluido un
controlador); `merchants` importa un caso de uso interno de `users`; `products` importa un caso de uso interno de `merchants`
(seis importaciones de archivos internos ajenos en total); ningún módulo expone un `index.ts` público. **Ninguna especificación
nueva MUST añadir importaciones cruzadas ni lecturas de tablas ajenas.** La remediación se planifica en la especificación de
regularización del módulo afectado, no como refactorización aislada.

## Alcance excluido de la primera versión

Sin app móvil nativa (RC15), SUNAT (RC16), delivery (RC17), hardware especializado (RC18) ni verificación RENIEC (RC19).
Una especificación MUST NOT incluirlos sin enmienda previa de `docs/`.

## Flujo de desarrollo obligatorio (SDD)

Todo módulo y toda funcionalidad nueva sigue **en este orden**, sin omitir etapas:

| # | Etapa | Herramienta | Producto y condición de salida |
|---|---|---|---|
| 1 | Especificación | `/speckit-specify` | `spec.md` con Trazabilidad completa y criterios de aceptación medibles; sin detalles de implementación |
| 2 | Aclaración | `/speckit-clarify` | Cero marcadores `NEEDS CLARIFICATION` pendientes; decisiones registradas |
| 3 | Plan | `/speckit-plan` | `plan.md`, `data-model.md`, `contracts/`; **Constitution Check** aprobado |
| 4 | Tareas | `/speckit-tasks` | `tasks.md` por historia, con tareas de prueba y rutas exactas |
| 5 | Análisis | `/speckit-analyze` | Sin incoherencias entre spec, plan y tareas; sin conflictos con la constitución |
| 6 | Implementación | `/speckit-implement` | Código por capas según el plan; tareas marcadas |
| 7 | Pruebas | `npm test`, `npm run test:e2e`, `npm run test:db`, `build`, `lint` | Resultados reales de los cuatro tipos de verificación del principio IX |
| 8 | Revisión | Revisión por pares o `/code-review` | Checklist de la sección Governance; informe de lo implementado, lo verificado y lo pendiente |

- Cada etapa requiere la aprobación del equipo antes de pasar a la siguiente, salvo la 6→7, que es continua.
- Un cambio de alcance durante la implementación MUST volver a la etapa 1 o 2 y actualizar la especificación.
- **Acciones que requieren orden explícita del equipo en cada ocasión:** ejecutar migraciones sobre la base compartida,
  `git commit`, `git push`, merge y cualquier operación con credenciales reales. El flujo automatizado MUST NOT realizarlas por sí mismo.
- Orden recomendado de módulos pendientes (por dependencias): Configuración operativa → Inventario → Carrito → Pedidos → Pagos.

## Governance

- **Jerarquía:** esta constitución prevalece sobre prácticas y plantillas locales; `docs/` (RF, RC, AC, ADR) es la fuente
  de los requisitos y las decisiones, y no se contradice sin enmienda.
- **Estado de los ADR:** ADR-001, 002, 003 y 005 figuran como "Propuesta" en `docs/`; se tratan como vigentes por decisión
  del equipo hasta que se marquen "Aceptada" (DEC-04). ADR-004 está **reemplazado por ADR-005**: no es fuente de requisitos
  (QR de Yape/Plin y validación manual no aplican).
- **Decisiones pendientes:** las decisiones DEC-01 a DEC-12 listadas en `docs/06-gobernanza-sdd/01-revision-de-consistencia.md`
  no están aprobadas. Ninguna especificación puede darlas por resueltas; cuando el equipo las apruebe se registran en un ADR
  y en una enmienda de esta constitución.
- **Enmiendas:** se proponen por escrito (qué cambia, por qué, impacto en módulos y plantillas), las aprueban los dos
  integrantes y se registran en el Sync Impact Report. Cambiar una decisión de `docs/` exige un ADR nuevo que la reemplace.
- **Versionado (SemVer):** MAJOR = principio eliminado o redefinido de forma incompatible; MINOR = principio o sección nueva
  o ampliación material; PATCH = aclaraciones sin cambio semántico.
- **Cumplimiento:** el plan incluye el *Constitution Check*; toda revisión verifica los principios I–X. Las excepciones se
  documentan en *Complexity Tracking* con la alternativa más simple descartada y su justificación.
- **Checklist de revisión (etapa 8):** módulos sin importaciones cruzadas internas · dominio/aplicación sin dependencias
  de framework · autorización y pruebas de denegación · pruebas de acceso cruzado entre comerciantes · sin secretos en el
  repositorio · migración aditiva y con RLS · importes exactos · trazabilidad HU/RF/ADR · resultados reales de pruebas.
- **Idioma:** documentación, especificaciones y mensajes de usuario en español; los identificadores de código siguen las
  convenciones del repositorio.

**Version**: 1.1.1 | **Ratified**: TODO(RATIFICATION_DATE): pendiente de aprobación de los dos integrantes (borrador vigente) | **Last Amended**: 2026-11-05
