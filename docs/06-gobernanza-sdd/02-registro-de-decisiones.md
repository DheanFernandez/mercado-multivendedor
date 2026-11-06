# Registro de decisiones pendientes (DEC-01 a DEC-12)

> **Estado de todas las decisiones: `PENDIENTE`.** Este documento solo **propone**; ninguna decisión se considera tomada hasta que los dos integrantes la marquen como `APROBADA` en la tabla de seguimiento (§1) y, cuando corresponda, quede registrada en un ADR y en una enmienda de la constitución.
> **Constitución de referencia:** `.specify/memory/constitution.md` v1.1.1 · **Análisis de origen:** [01-revision-de-consistencia.md](01-revision-de-consistencia.md)

## 1. Tabla de seguimiento (la completa el equipo)

| ID | Decisión | Recomendación | Estado | Fecha | Aprobada por | Bloquea |
|---|---|---|---|---|---|---|
| DEC-01 | Modelo de distribución del pago único | Opción B (distribución contable simulada) | `PENDIENTE` | — | — | Especificaciones de Pagos |
| DEC-02 | Vinculación de cuentas de comerciantes | Opción 2 (vinculación simulada), si DEC-01 = B | `PENDIENTE` | — | — | Pagos fase 2; HU11, HU27 |
| DEC-03 | Contratos públicos entre módulos | Aprobar [03-contratos-publicos-entre-modulos.md](03-contratos-publicos-entre-modulos.md) | `PENDIENTE` | — | — | Tareas de deuda de R1, R2 y R3 |
| DEC-04 | Estado de los ADR 001, 002, 003 y 005 | Aceptar 001–003 ya; 005 junto con ADR-006 | `PENDIENTE` | — | — | — |
| DEC-05 | Prioridad de Auditoría | Especificarla antes de Inventario | `PENDIENTE` | — | — | Inventario, Pedidos, Pagos |
| DEC-06 | Nombres de módulos: documentación frente a código | Conservar el código y publicar la equivalencia | `PENDIENTE` | — | — | — |
| DEC-07 | Infraestructura de calidad por fases | Aprobar las fases 1 y 2 | `PENDIENTE` | — | — | Pruebas de concurrencia de Inventario |
| DEC-08 | Workflow SDD de ocho etapas | Adoptar [workflows/mercado-sdd.yml](workflows/mercado-sdd.yml) | `PENDIENTE` | — | — | — |
| DEC-09 | Permisos y trabajadores de puesto | Permisos por puesto con asignación explícita | `PENDIENTE` | — | — | Pedidos (RF36, RF39) |
| DEC-10 | Tiendas virtuales | Página pública del puesto, sin entidad nueva | `PENDIENTE` | — | — | RF08 |
| DEC-11 | Herramientas SDD en Git y carpeta `specs/` | Versionar `.specify/` y los skills de Spec Kit | `PENDIENTE` | — | — | — |
| DEC-12 | Enmiendas editoriales a `docs/` y ratificación | Un único cambio de documentación | `PENDIENTE` | — | — | Ratificación de la constitución |

Valores de estado: `PENDIENTE` · `APROBADA` · `APROBADA CON CAMBIOS` · `RECHAZADA` · `APLAZADA`.

## 2. Dependencias entre decisiones

```text
DEC-01 ──► DEC-02 ──► Pagos fase 2 (vinculación, distribución, comisiones)
   │
   └────► DEC-04 (ADR-005 se acepta junto con ADR-006)
DEC-03 ──► tareas de deuda de R1, R2, R3 ──► DEC-07 (regla automática de dependencias)
DEC-07 (fase 2) ──► pruebas de concurrencia de Inventario
DEC-05 ──► Inventario / Pedidos / Pagos (usan Auditoría según C4 nivel 3)
DEC-09 ──► Pedidos (RF36, RF39) ; DEC-10 ──► HU11 (sin vinculación)
DEC-12 ──► ratificación de la constitución
```

## 3. Detalle de cada decisión

### DEC-01 · Modelo de distribución del pago único

- **Por qué se decide:** ADR-005 elige el Checkout de pago único pero DA08, RC14 y RF52 presuponen cuentas vinculadas por comerciante (C-01). Sin esta decisión no puede especificarse `payments`. Detalle en el [borrador de ADR-006](borradores/ADR-006-modelo-de-pagos-y-distribucion.md).
- **Opciones:**

| Opción | Descripción | A favor | En contra |
|---|---|---|---|
| A | Split real desde la primera versión | Cumple DA08 al pie de la letra | ADR-005 la deja como respaldo; sus condiciones en Mercado Pago no están verificadas por el equipo; máxima complejidad |
| **B** | Cobro único Sandbox + distribución contable **simulada** rotulada «Simulado» | Entrega el flujo completo sin depender de capacidades no verificadas; permite cambiar a Split después (EQ-07) | Hay que enmendar requisitos (ver ADR-006 §10); riesgo de presentarla como real |
| C | Cobro único + cobro centralizado con liquidación posterior | Contabilidad real | Proceso operativo y contable fuera del alcance inicial |

- **Recomendación:** B.
- **Impacto si se aprueba B:** ADR-006 nuevo; enmiendas a ADR-005, RC14, RF52, RF53, RF55, HU11, HU27, HU28, DA08, `01-actores.md` y C4; puerto `DistribucionPagoPort`; principio VI de la constitución pasa de bloqueo a regla.
- **Si se rechaza o aplaza:** `payments` solo puede especificarse hasta la aclaración; el resto de módulos continúa.
- **Estado:** `PENDIENTE`.

### DEC-02 · Vinculación de cuentas de comerciantes

- **Por qué se decide:** RF52 y HU27 exigen vincular y desvincular la cuenta; ADR-005 §7 pide tokens cifrados. La vinculación **real** solo tiene sentido con una distribución real (Split).
- **Opciones:**

| Opción | Descripción | A favor | En contra |
|---|---|---|---|
| 1 | Autorización real de la cuenta (OAuth) con tokens cifrados desde la primera versión | Cumple RC14 literalmente | Requiere aplicación de Mercado Pago, usuarios vendedores de prueba y cifrado AES-GCM; no aporta si la distribución es simulada |
| **2** | Vinculación **simulada**: indicador explícito `vinculada` que el comerciante titular activa o desactiva, rotulado como demostración. La regla de RF52 («sin vinculación no se incluye en un cobro») se **conserva** | Mantiene RF52 y HU27 verificables sin depender de la pasarela; un adaptador real puede sustituirla | No hay tokens reales que proteger; hay que explicar que es una demostración |
| 3 | Diferir RF52/HU27 y no exigir vinculación en la primera versión | Menos trabajo | Contradice RC14 y ADR-005 §10 sin sustituto |

- **Recomendación:** 2 si DEC-01 = B; 1 si DEC-01 = A.
- **Impacto:** módulo `merchants` (campo y caso de uso de vinculación), `payments` (consulta de puestos vinculados), frontend del comerciante, HU11/HU27, C4.
- **Estado:** `PENDIENTE`. **Depende de:** DEC-01.

### DEC-03 · Contratos públicos entre módulos

- **Por qué se decide:** 6 importaciones de archivos internos ajenos y una lectura de tablas ajenas (C-05 a C-08). Propuesta completa en [03-contratos-publicos-entre-modulos.md](03-contratos-publicos-entre-modulos.md).
- **Sub-decisiones y opciones:**

| Tema | Opciones | Recomendación |
|---|---|---|
| a) Contrato público | `index.ts` por módulo con fachada (diseño interno); o solo `exports` de Nest | `index.ts` con fachada |
| b) Catálogo | (i) componer las APIs públicas de `products` y `merchants`; (ii) proyección propia alimentada por eventos; (iii) mover el catálogo dentro de `products`; (iv) mantener la lectura directa con una excepción documentada | (i) |
| c) `auth` y `users` | Dos módulos Nest con una sola API pública; o un único módulo | Dos módulos, una API pública (`UsuariosApi`) |

- **Impacto:** tareas de remediación dentro de R1, R2 y R3; ningún cambio de comportamiento ni de esquema; regla `dependency-cruiser` (DEC-07).
- **Estado:** `PENDIENTE`.

### DEC-04 · Estado de los ADR

- **Por qué se decide:** ADR-001, 002, 003 y 005 figuran como «Propuesta» (C-03).
- **Opciones:** (1) aceptar los cuatro ahora; (2) aceptar 001–003 ahora y ADR-005 junto con ADR-006 *(recomendada)*; (3) mantenerlos como propuesta.
- **Impacto:** editar el campo «Estado» de cada ADR y `estilo-arquitectonico.md` / `enfoque-arquitectonico.md`; la constitución deja de tratarlos «por decisión del equipo».
- **Estado:** `PENDIENTE`.

### DEC-05 · Prioridad de Auditoría

- **Por qué se decide:** RF42 y DA10 son prioritarios, pero hoy ninguna operación crítica queda auditada (C-13) y C4 nivel 3 hace que Inventario, Pedidos y Pagos la usen.
- **Opciones:** (1) especificar y construir Auditoría **antes** de Inventario *(recomendada)*; (2) registro estructurado interino (logs) y Auditoría después de Pagos; (3) diferir sin interino.
- **Impacto:** orden de especificaciones; puerto `AuditoriaPort`; tabla nueva (migración aditiva futura); revisión del alcance de HU26.
- **Estado:** `PENDIENTE`.

### DEC-06 · Nombres de módulos: documentación y código

- **Por qué se decide:** `docs/` usa español (`usuarios`, `pagos`) y el código inglés (`users`, `payments`) (C-09).
- **Opciones:** (1) conservar el código y mantener la tabla de equivalencia de la constitución *(recomendada)*; (2) renombrar el código al español (refactorización amplia); (3) cambiar la documentación al inglés.
- **Impacto:** (1) ninguno en código; (2) y (3) cambios masivos y riesgo sin beneficio funcional.
- **Estado:** `PENDIENTE`.

### DEC-07 · Infraestructura de calidad por fases

- **Por qué se decide:** los escenarios EQ-02/03/07/08 se miden con herramientas que no existen en el repositorio (C-10); las pruebas de base de datos usan la base compartida.
- **Fases propuestas:** (1) GitHub Actions con build, lint y pruebas sin base de datos + `dependency-cruiser`; (2) PostgreSQL desechable (Testcontainers o Docker) para integración y concurrencia; (3) MSW/nock y pruebas de contrato de `PasarelaPagoPort`; (4) k6 y Lighthouse; (5) logs estructurados y Sentry, Toxiproxy.
- **Opciones:** (1) todas las fases en orden; (2) solo fases 1 y 2 ahora y el resto antes de su módulo *(recomendada)*; (3) ninguna, con riesgo para AC07 y AC03.
- **Pregunta abierta:** ¿ambos integrantes pueden ejecutar Docker? Si no, la fase 2 necesita otra alternativa (Postgres local o un proyecto Supabase de pruebas).
- **Impacto:** nuevos archivos de configuración y dependencias de desarrollo; sin cambios en el código de la aplicación.
- **Estado:** `PENDIENTE`.

### DEC-08 · Workflow SDD de ocho etapas

- **Por qué se decide:** el flujo incluido en Spec Kit no tiene Aclarar, Analizar, Probar ni Revisar (C-21). Propuesta en [04-workflow-sdd-ocho-etapas.md](04-workflow-sdd-ocho-etapas.md).
- **Opciones:** (1) adoptar el workflow propio, sin tocar el original *(recomendada)*; (2) seguir el flujo solo por disciplina, ejecutando cada skill a mano; (3) modificar el workflow de Spec Kit (no recomendado: es un archivo generado).
- **Impacto:** ninguno en la aplicación; define cómo se verifica cada etapa.
- **Estado:** `PENDIENTE`.

### DEC-09 · Permisos y trabajadores de puesto

- **Por qué se decide:** RF05 y HU20 piden gestionar roles y permisos; hoy hay un rol único sin permisos y `TRABAJADOR_PUESTO` no tiene atribuciones (C-14). RF36 y RF39 mencionan al trabajador autorizado.
- **Opciones:**

| Opción | Descripción | En contra |
|---|---|---|
| **1** | Rol fijo por usuario + asignación explícita trabajador↔puesto con un conjunto pequeño de permisos (preparar, entregar, consultar productos, apoyar inventario) | Poco flexible |
| 2 | RBAC completo con tablas de roles y permisos | Excesivo para el alcance (RF05 no exige tanto) |
| 3 | Diferir: solo el comerciante prepara y entrega | RF36/RF39 y HU19 quedan incompletos |

- **Recomendación:** 1, especificada antes de Pedidos.
- **Impacto:** tablas nuevas, módulos `merchants` y `users`, frontend del comerciante.
- **Estado:** `PENDIENTE`.

### DEC-10 · Tiendas virtuales

- **Por qué se decide:** RF08 y HU11 hablan de tiendas virtuales asociadas a puestos; hoy no hay entidad tienda (C-16).
- **Opciones:** (1) la «tienda» es la **página pública del puesto**, con sus datos y productos, sin entidad nueva *(recomendada)*; (2) entidad `Tienda` 1:1 con el puesto (logo, banner, descripción); (3) diferir.
- **Impacto:** (1) una ruta pública y una consulta en el catálogo; (2) esquema y almacenamiento adicionales.
- **Estado:** `PENDIENTE`.

### DEC-11 · Herramientas SDD en Git y carpeta `specs/`

- **Por qué se decide:** `.specify/`, `.claude/skills/`, `.agents/`, `.windsurf/` y `skills-lock.json` están sin versionar (C-23); Spec Kit guardará las especificaciones en `specs/` de la raíz.
- **Opciones:** (1) versionar `.specify/` y los skills `speckit-*`; ignorar `.agents/`, `.windsurf/` y los skills de Prisma duplicados *(recomendada)*; (2) versionar todo; (3) no versionar nada (cada integrante inicializa Spec Kit).
- **Impacto:** `.gitignore` y primer commit de gobernanza (solo cuando el equipo lo ordene).
- **Estado:** `PENDIENTE`.

### DEC-12 · Enmiendas editoriales y ratificación

- **Por qué se decide:** C-04, C-11 y C-12 son correcciones menores de documentación; la constitución sigue como borrador.
- **Cambios editoriales propuestos (no aplicados):** reemplazar el TODO de autenticación de C4 N2 §6 por la decisión implementada; cambiar «Drizzle + Faker» por Prisma en EQ-05; anotar en la fila de ADR-004 del resumen que su rótulo de DA08 corresponde a un ADR reemplazado.
- **Opciones:** (1) un único cambio de documentación tras aprobar DEC-01 a DEC-11 *(recomendada)*; (2) aplicarlos ahora; (3) diferirlos.
- **Ratificación:** completar la fecha en la constitución cuando ambos aprueben.

| Integrante | Aprueba la constitución | Fecha |
|---|---|---|
| Fernandez Pillman Dhean Jhoner | ☐ | — |
| Gómez Prado Ederson | ☐ | — |

- **Estado:** `PENDIENTE`.

## 4. Clasificación general

| Categoría | Contenido |
|---|---|
| **Aprobadas** | Ninguna de DEC-01 a DEC-12. Siguen vigentes, **por declaración del equipo** (no formalizadas porque los ADR figuran como «Propuesta»): monolito modular con NestJS; Clean Architecture por módulo; frontend Next.js/React/TypeScript; Prisma y PostgreSQL en Supabase; Supabase Auth con roles en PostgreSQL; ADR-003 (reservas atómicas); ADR-005 (pago único con Mercado Pago Sandbox); seguridad, calidad y trazabilidad de la constitución; el flujo de ocho etapas como obligación |
| **Propuestas** | DEC-01 a DEC-12; [borrador de ADR-006](borradores/ADR-006-modelo-de-pagos-y-distribucion.md); [contratos públicos](03-contratos-publicos-entre-modulos.md); [workflow](workflows/mercado-sdd.yml); [matriz de regularización](05-matriz-de-regularizacion.md) |
| **Bloqueantes** | DEC-01 y DEC-02 (Pagos); DEC-07 fase 2 (concurrencia de Inventario); DEC-09 (Pedidos); DEC-05 (Auditoría antes de Inventario). Ver [README](README.md) |
