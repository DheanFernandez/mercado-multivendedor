# Revisión de consistencia de la constitución (SDD)

> **Estado:** propuesta para revisión del equipo. **Nada de lo que aquí figura como propuesta está aprobado.**
> **Fecha:** 2026-11-05 · **Constitución revisada:** `.specify/memory/constitution.md` v1.1.0
> **Alcance:** análisis de documentación, constitución, plantillas de Spec Kit, código y pruebas. No se modificó código ni documentos oficiales de `docs/01` a `docs/05`.

## 1. Método

Se compararon la constitución y el código con ADR-001 a ADR-005, los 55 requisitos funcionales (RF), las 29 historias de usuario (HU), restricciones (RC), atributos de calidad (AC), drivers (DA), escenarios de calidad (EQ), los cuatro niveles C4, el diseño interno de módulos y los módulos de backend y frontend. La numeración **C-xx** identifica hallazgos y **DEC-xx** decisiones pendientes.

## 2. Matriz de contradicciones

Gravedad: **Alta** impide especificar o rompe una regla de arquitectura; **Media** afecta la trazabilidad o la verificabilidad; **Baja** es editorial.

| ID | Documento(s) | Requisito o regla afectada | Hallazgo | Impacto | Solución propuesta | ¿Aprobación? |
|---|---|---|---|---|---|---|
| C-01 | ADR-005 §4, §5.1, §5.6, §9, §10; DA08; RC14; RF52; HU11; HU27; C4 N1/N2/N3 | Pago único y vinculación de cuentas | ADR-005 **selecciona** "Checkout con pago único" pero exige que cada comerciante vincule su cuenta y que el cobro se asocie a "la cuenta vinculada de cada comerciante" (DA08), que es semántica de Split, alternativa que el mismo ADR deja como **respaldo**. Distribuir el pago único "depende del proveedor" (§9) | **Alta.** El módulo `payments` no puede especificarse sin ambigüedad | Separar los cuatro conceptos (§3) y aprobar un ADR nuevo con la modalidad de distribución | **Sí** (DEC-01, DEC-02) |
| C-02 | Constitución v1.0.0 (D-001); ADR-005; RC14; RF52/53; DA08 | Distribución contable simulada | La constitución v1.0.0 registraba la simulación como "decisión"; no existe en `docs/` y no estaba aprobada | **Alta.** Decisión unilateral | **Corregido en v1.1.0**: ahora es una propuesta bloqueada hasta DEC-01/DEC-02 | **Sí** (DEC-01) |
| C-03 | ADR-001, 002, 003, 005; `estilo-arquitectonico.md`; `enfoque-arquitectonico.md`; README | Autoridad de los ADR | Los ADR figuran como "Propuesta" y los documentos de arquitectura como "Arquitectura propuesta", pero el README habla de "Arquitectura seleccionada" y el código ya los aplica | Media. Autoridad ambigua | Marcarlos "Aceptada" tras la aprobación del equipo; mientras tanto la constitución los trata como vigentes | **Sí** (DEC-04) |
| C-04 | C4 N2 §6 (TODO); `docs/05-implementacion/02` | DA03, RF02, RF03 | El TODO sobre el mecanismo de autenticación sigue abierto, pero ya se implementó Supabase Auth | Baja. Documento desactualizado | Reemplazar el TODO por la decisión ya implementada | Editorial (DEC-12) |
| C-05 | C4 N3 §5 y regla 3 ("un módulo no lee ni escribe las tablas de otro"); N3 §4 ("Catálogo obtiene productos… por su API pública") | ADR-001 §5; AC05; RC12 | `catalog` consulta con Prisma las tablas `producto`, `categoria`, `puesto` y `comerciante`, de otros módulos | **Alta.** Rompe la independencia de datos entre módulos | Ver contratos (§4): el catálogo compone consultas públicas de `products` y `merchants` | **Sí** (DEC-03) |
| C-06 | C4 N3 regla 2; diseño interno (`index.ts`, patrón Facade) | Límites entre módulos | Ningún módulo tiene `index.ts` público. Se encontraron 6 importaciones de archivos internos ajenos (§4.1; la primera versión de esta revisión contó 4 por un escaneo incompleto) | Media-Alta. Acoplamiento | Definir `index.ts` por módulo y reglas automáticas de dependencias | **Sí** (DEC-03, DEC-07) |
| C-07 | C4 N3; ADR-002 (el controlador depende de casos de uso, no de otros controladores) | Capas de Clean Architecture | `auth.controller.ts` importa `vistaUsuario` del controlador de `users` | Media. Acoplamiento entre capas de presentación | El módulo `users` publica un caso de uso que devuelve un DTO de perfil | **Sí** (DEC-03) |
| C-08 | ADR-001 §5; C4 N3 | Módulos "Autenticación y usuarios" | La documentación define un módulo; el código tiene dos (`auth`, `users`) | Baja-Media. Trazabilidad | Mantener dos módulos Nest como un solo contexto con API pública única, o fusionarlos | **Sí** (DEC-03, DEC-06) |
| C-09 | C4 N3 columna "Carpeta"; diseño interno (`postgres-*.repository.ts`) | Trazabilidad docs→código | Nombres en español en la documentación (`usuarios`, `pagos`) e inglés en el código (`users`, `payments`); `postgres-*` frente a `prisma-*` | Baja-Media | Conservar el código y publicar la equivalencia (ya en la constitución) | **Sí** (DEC-06) |
| C-10 | EQ-02, EQ-03, EQ-07, EQ-08; constitución IX | AC07, AC08, AC03 | Las pruebas se miden con Testcontainers, MSW/nock, k6, Toxiproxy, dependency-cruiser y GitHub Actions. Nada de esto está instalado, no existe `.github/` y las pruebas de base de datos usan la base compartida de Supabase | **Alta** para Inventario y Pagos: AC07 y AC03 no son verificables como se documentó; la concurrencia sobre datos reales es riesgosa | Adoptar la infraestructura por fases (§6); constitución v1.1.0 ya limita la concurrencia sobre datos reales | **Sí** (DEC-07) |
| C-11 | EQ-05 | Persistencia con Prisma (decisión del proyecto) | El escenario nombra "Drizzle + Faker" para el seed | Baja | Cambiar por seed de Prisma | Editorial (DEC-12) |
| C-12 | `07-decisiones-arquitectonicas.md` (fila ADR-004) | DA08 | La fila de ADR-004 todavía rotula DA08 como "Pagos por QR" (principal), cuando DA08 ahora es pago único con pasarela | Baja | Anotar que el rótulo pertenece a un ADR reemplazado | Editorial (DEC-12) |
| C-13 | RF42; DA10 (driver prioritario); AC06 | Trazabilidad de operaciones críticas | No existe el módulo Auditoría ni registro estructurado. Quedan sin auditar: invitaciones, altas de comerciantes y puestos, cambios de productos y la promoción de roles | **Alta** para un driver prioritario | Especificar Auditoría (mínimo: puerto y tabla) antes de Inventario, Pedidos y Pagos, que la usan según C4 N3 | **Sí** (DEC-05) |
| C-14 | RF05; HU20; actores | Gestión de roles y permisos | Rol único por usuario (enum) sin permisos; `TRABAJADOR_PUESTO` existe sin atribuciones ni asignación por puesto | Media. Bloquea RF36 y RF39 | Especificar el modelo de permisos y la asignación de trabajadores a puestos | **Sí** (DEC-09) |
| C-15 | RF19 (detalle **y disponibilidad**); C4 N3 §4 | HU03 | El detalle público no muestra disponibilidad: depende de Inventario | Media (parcial conocido) | Cerrar al implementar Inventario | No |
| C-16 | RF08; HU11; RF52 | Tiendas virtuales | No existe la entidad tienda; el puesto cumple su rol de hecho | Media | Decidir si la tienda es una entidad o la página pública del puesto | **Sí** (DEC-10) |
| C-17 | RF45; ADR-003 §6.5; ADR-005; C4 N3 (Pedidos e Inventario consultan Configuración) | Tiempos de reserva y expiración | Configuración operativa es prerrequisito de Inventario y Pagos y aún no existe | Media. Orden de especificaciones | Especificarla antes de Inventario | No (orden en §8) |
| C-18 | RC01; DA13 | PWA | El frontend es una aplicación web responsive, sin manifiesto ni service worker | Baja-Media | Especificación posterior dedicada | No |
| C-19 | C4 N2 §6 ("archivos sensibles por URL firmadas") | Privacidad AC12 | Las imágenes de producto se sirven desde un bucket público | Baja. Coherente si no son sensibles | Aclarar en la especificación: imágenes de producto públicas; documentos, firmados | No |
| C-20 | ADR-002, ADR-003 ("Presentación"); diseño interno (`entry-adapters`) | Nombre de la capa de entrada | Dos nombres para la misma capa | Baja | La constitución fija `entry-adapters` | No |
| C-21 | Spec Kit `workflow.yml` v1.0.0 | Flujo de 8 etapas | Solo ejecuta especificar → plan → tareas → implementar; faltan Aclarar, Analizar, Probar y Revisar | Media | Workflow propio (§5) | **Sí** (DEC-08) |
| C-22 | Spec Kit `tasks-template.md` | Constitución IX y flujo | Marcaba las pruebas como opcionales y sugería "commit tras cada tarea" | Media | **Corregido** en la plantilla (pruebas obligatorias; sin commits automáticos) | No |
| C-23 | `.specify/`, `.claude/skills/`, `.agents/`, `.windsurf/`, `skills-lock.json` | RC10 (Git y GitHub) | Las herramientas SDD están sin versionar; `.agents` y `.windsurf` duplican habilidades de Prisma | Baja-Media | Versionar `.specify/` y `.claude/skills/`; ignorar `.agents/` y `.windsurf/` | **Sí** (DEC-11) |

## 3. Pagos y Mercado Pago

### 3.1 Cuatro conceptos que hoy se mezclan

| # | Concepto | Qué es | Dónde está en `docs/` | Necesita cuentas de comerciantes | Mueve dinero real |
|---|---|---|---|---|---|
| 1 | **Pago único del cliente** (Mercado Pago Checkout Sandbox) | Un cobro por pedido = suma de subtotales por puesto; confirmación por Webhook verificado y consulta a la API | RC13; RF32–RF35; RF47–RF49; ADR-005 §5.1–5.4 | No | Solo dinero de prueba (Sandbox) |
| 2 | **Vinculación de cuentas de comerciantes** | Cada comerciante autoriza su cuenta de Mercado Pago; los tokens se guardan cifrados | RC14; RF52; HU11; HU27; ADR-005 §5.6, §7.3 | Sí | No por sí sola |
| 3 | **Distribución financiera real** | El dinero cobrado llega a cada comerciante (Split/marketplace o liquidación posterior) | ADR-005 §4 (ambas son "Respaldo"); DA08 | Sí (Split) | Sí |
| 4 | **Distribución contable simulada** | Registro interno por puesto de subtotal, comisión e importe neto, **sin** movimiento de dinero, para la demostración | **No existe en `docs/`.** Cercana: RF53, RF55, HU28 y el simulador `PasarelaPagoLocalAdapter` del diseño interno (que es para pruebas, no para esto) | No | No |

### 3.2 Alternativas

| Opción | Descripción | A favor | En contra |
|---|---|---|---|
| **A. Split real desde la primera versión** | Checkout con división: cada puesto cobra en su cuenta vinculada | Cumple al pie de la letra DA08, RC14 y RF52 | ADR-005 la deja como respaldo; depende de condiciones de Mercado Pago para pagos multivendedor; mayor complejidad y riesgo de no poder verificarla en Sandbox |
| **B. Pago único + distribución contable simulada + vinculación diferida o simulada** *(recomendada)* | Cobro único Sandbox; por pedido se registran subtotal, comisión y neto por puesto con modo `SIMULADA`; la vinculación real se pospone | Entrega el flujo completo de compra y pagos sin depender de capacidades no verificadas; mantiene el reemplazo por Split (EQ-07) | Requiere actualizar requisitos (§3.4); el riesgo es presentar la simulación como real, por eso se rotula |
| **C. Pago único + cobro centralizado con liquidación posterior** | La plataforma recauda y liquida después | Contabilidad real | El proceso operativo y contable queda fuera del alcance inicial (ADR-005 §4) |

### 3.3 Decisión arquitectónica propuesta (borrador de ADR-006, **no creado**)

1. Mantener ADR-005 para el **pago único** (concepto 1).
2. Introducir un puerto de aplicación `DistribucionPagoPort` junto a `PasarelaPagoPort`, con la modalidad seleccionada por configuración (`DISTRIBUCION_PAGO_MODO = simulada | split | centralizada`), siguiendo el patrón Strategy que el diseño interno ya usa para `PASARELA_PAGO_MODO`.
3. En la primera versión solo existe el adaptador `simulada`: registra una `DistribucionPago` por puesto con `modo = SIMULADA`, subtotal, comisión informada por la pasarela e importe neto; no llama a ninguna API de reparto.
4. La vinculación (concepto 2) se ofrece en dos niveles: indicador `vinculada` administrado en la demostración, y la autorización real con tokens cifrados como especificación posterior, que solo se activa con un adaptador `split`.
5. Todo dato y toda pantalla de la distribución simulada muestran la etiqueta «Simulado»; nunca se usa la palabra «liquidación» para ellos.
6. El paso a distribución real exige un ADR posterior con una prueba de concepto verificada en Sandbox.

### 3.4 Requisitos que habría que actualizar si el equipo acepta la simulación (no se modificaron)

| Documento | Elemento | Cambio propuesto |
|---|---|---|
| ADR-005 | §5.1, §5.6, §9, §10, §12; estado | Enmendar o dejar parcialmente reemplazado por ADR-006; precisar que el cobro lo recibe una única cuenta de la plataforma |
| Nuevo ADR-006 | — | Registrar la decisión de §3.3 |
| `05-restricciones.md` | RC14 | Aclarar que la vinculación real puede diferirse; la comisión del comerciante se registra contablemente |
| `03-requisitos-funcionales.md` | RF52, RF53, RF55 | Criterios de aceptación para vinculación simulada y para neto/comisión simulados |
| `02-historias-de-usuario.md` | HU11, HU27, HU28 | Matizar "recibir los cobros" y "comprobar que la cuenta esté vinculada" |
| `06-drivers-arquitectonicos.md` | DA08 | Quitar "asociar el cobro a la cuenta vinculada de cada comerciante" o condicionarlo a la modalidad |
| `01-actores.md` | §3 y §5 | Idem |
| C4 N1, N2, N3 | Flujo "Comerciante → Mercado Pago", cuentas vinculadas cifradas, relación Pagos → Comerciantes | Marcar como "modalidad Split" |
| Diseño interno, patrones y principios | Adaptadores y variable de modo | Agregar `DistribucionPagoPort` y el adaptador `simulada` |
| `04-atributos-de-calidad.md` | AC04 (pagos) | Los tokens cifrados aplican cuando existan tokens |
| `08-escenarios-atributos-calidad.md` | EQ-07 | Incluir el intercambio `simulada` ↔ `split` |
| Constitución | Principio VI | Pasar de bloqueo a regla, tras la aprobación |

## 4. Límites entre módulos

### 4.1 Importaciones que vulneran los límites

| Origen | Importa | Tipo | Regla vulnerada |
|---|---|---|---|
| `auth/infrastructure/usuario-por-auth-id.adapter.ts` | `users/application/use-cases/resolver-usuario-por-auth-id.use-case` | Caso de uso interno | C4 N3 regla 2 |
| `auth/entry-adapters/auth.controller.ts` | `users/application/use-cases/consultar-usuario…` y `registrar-cliente…` | Casos de uso internos (2 archivos) | Regla 2 |
| `auth/entry-adapters/auth.controller.ts` | `users/entry-adapters/controllers/usuarios.controller` (`vistaUsuario`) | **Capa de presentación ajena** | Regla 2; ADR-002 |
| `merchants/infrastructure/adapters/usuario-consulta.adapter.ts` | `users/application/use-cases/obtener-resumen-usuario.use-case` | Caso de uso interno | Regla 2 |
| `products/infrastructure/puesto-consulta.adapter.ts` | `merchants/application/use-cases/puestos.use-cases` | Casos de uso internos | Regla 2 |
| `catalog/infrastructure/prisma-catalogo.repository.ts` | Tablas `producto`, `categoria`, `puesto`, `comerciante` | **Tablas ajenas** | Regla 3; N3 §5 |

Las capas `domain/` y `application/` no importan NestJS ni Prisma (verificado con búsqueda en el código).

### 4.2 Contratos públicos propuestos (sin microservicios ni cambios de estilo)

Cada módulo publica un `index.ts` con **solo** lo que otros módulos pueden usar; los consumidores definen su puerto y lo implementan con un adaptador de infraestructura que usa únicamente ese `index.ts`.

| Módulo proveedor | API pública propuesta | Consumidores | Reemplaza a |
|---|---|---|---|
| `users` | `UsuariosApi`: `resolverPorAuthId`, `obtenerResumen`, `registrarCliente`, `obtenerPerfil(id, actor)` → `PerfilUsuarioDto` | `auth`, `merchants` | Importaciones de casos de uso internos y de `vistaUsuario` |
| `merchants` | `PuestosApi`: `obtenerPuesto(id)`, `idsDePuestosDeTitular(usuarioId)`, `listarPuestosOperativos()` → `PuestoResumen` | `products`, `catalog`, y luego `inventory`, `orders`, `payments` | Importación interna de `products` |
| `products` | `ProductosPublicadosApi`: `buscarPublicados(filtro, puestoIds)`, `obtenerPublicado(id)` → `ProductoPublico` (con su categoría) | `catalog`, y luego `cart`, `orders` | Lectura directa de tablas por `catalog` |
| `inventory` (futuro) | `ReservarInventarioUseCase`, `ConsultarDisponibilidad` (C4 N4) | `catalog`, `orders` | — |
| `catalog` | Sin API para otros módulos; **compone** `ProductosPublicadosApi` + `PuestosApi` + disponibilidad | Frontend | — |

Con el tamaño de un mercado (decenas o cientos de puestos) el catálogo obtiene los puestos operativos de `merchants` y se los pasa a `products` como filtro; no requiere tablas de proyección. Si el volumen lo exigiera, se evaluaría una proyección propia del catálogo alimentada por eventos (Outbox), con su propio ADR.

### 4.3 Cómo evitarlo en el futuro

- Regla automática (propuesta DEC-07): `dependency-cruiser` (ya nombrado en EQ-07) prohibiendo importar cualquier ruta de otro módulo que no sea su `index.ts`, y prohibiendo NestJS, Prisma y `jose` en `domain/` y `application/`.
- Convención de revisión: cada módulo accede solo a sus propios modelos Prisma; el *checklist* de Governance lo verifica.
- Las remediaciones se ejecutan dentro de las especificaciones de regularización (§7), no como refactorizaciones sueltas.

## 5. Flujo SDD: capacidades reales de Spec Kit y cómo ejecutarlo

### 5.1 Capacidades verificadas (Spec Kit 0.12.12.dev0)

- **Skills disponibles** (`/speckit-…`): `constitution`, `specify`, `clarify`, `checklist`, `plan`, `tasks`, `analyze`, `implement`, `converge`, `taskstoissues`.
- `analyze` es **estrictamente de solo lectura** y trata la constitución como no negociable; `converge` compara el código con spec/plan/tareas y agrega las tareas faltantes; `checklist` genera listas de calidad de requisitos.
- `plan`, `tasks`, `clarify`, `analyze` e `implement` leen la constitución. No existe `extensions.yml` ni extensiones instaladas, de modo que **no hay hooks** (ni creación automática de ramas de Git); el directorio de la especificación se guarda en `.specify/feature.json` y es independiente de la rama.
- La CLI `specify workflow run <id|ruta.yml>` ejecuta flujos con pasos `command`, `gate`, `shell`, `prompt`, `if`, `while`, `switch`, `fan-out`, `fan-in` y `do-while`. El flujo incluido (`speckit` 1.0.0) tiene 6 pasos: **no** incluye Aclarar, Analizar, Probar ni Revisar.
- En esta sesión `/speckit-constitution` no estaba registrada como skill invocable; se siguió su procedimiento a mano. Si pasa de nuevo, los skills pueden ejecutarse desde una sesión de Claude Code iniciada en la raíz del repositorio.

### 5.2 Propuesta (DEC-08)

No modificar `.specify/workflows/speckit/workflow.yml` (archivo generado). Crear un workflow propio, por ejemplo `.specify/workflows/mercado-sdd.yml`, y ejecutarlo con:

```bash
specify workflow run .specify/workflows/mercado-sdd.yml -i spec="Descripción citando HU, RF y ADR"
```

Se probó un **borrador** que la CLI carga y muestra con sus 13 pasos (`specify workflow info <ruta>`); la ejecución real de los pasos `shell` no se probó. Estructura:

```yaml
steps: [specify, review-spec(gate), clarify, review-clarify(gate), plan, review-plan(gate),
        tasks, analyze, review-analysis(gate), implement,
        test-backend(shell: cd backend && npm run build && npm run lint && npm test && npm run test:e2e),
        test-frontend(shell: cd frontend && npm run lint && npm run build),
        review-final(gate)]
```

### 5.3 Cómo verificar cada etapa

| Etapa | Cómo se verifica | Evidencia |
|---|---|---|
| 1 Especificar | La sección *Trazabilidad* cita HU/RF/ADR existentes en `docs/`; criterios de aceptación medibles | `spec.md`; opcionalmente `/speckit-checklist` |
| 2 Aclarar | Sin marcadores `NEEDS CLARIFICATION`; decisiones pendientes (DEC) resueltas o bloqueadas | `spec.md` (sección Clarifications) |
| 3 Planificar | *Constitution Check* con las compuertas I–X en verde o justificadas | `plan.md`, `data-model.md`, `contracts/` |
| 4 Tareas | Cada historia con tareas de prueba y rutas exactas | `tasks.md` |
| 5 Analizar | `/speckit-analyze` sin hallazgos CRITICAL ni conflictos con la constitución | Informe de solo lectura |
| 6 Implementar | Tareas marcadas; código por capas | Código |
| 7 Probar | `build`, `lint`, `npm test`, `npm run test:e2e` y, si aplica, `npm run test:db`; `/speckit-converge` para detectar lo no construido | Resultados reales de cada comando |
| 8 Revisar | *Checklist* de Governance; informe de implementado, verificado y pendiente | Revisión por pares o `/code-review` |

La compuerta 7→8 requiere resultados **reales**; `test:db` queda como paso manual porque usa la base compartida.

## 6. Infraestructura de calidad propuesta (DEC-07)

| Fase | Qué | Por qué | Antes de |
|---|---|---|---|
| 1 | GitHub Actions con build, lint y pruebas (sin base de datos) en cada pull request; `dependency-cruiser` | RC10; EQ-07; cumplir C-06 | Cualquier módulo nuevo |
| 2 | PostgreSQL desechable (Testcontainers o Postgres local por Docker) para integración y concurrencia | EQ-02/03; evitar bloqueos sobre datos reales | **Inventario** |
| 3 | MSW/nock y pruebas de contrato de `PasarelaPagoPort` | EQ-01/07/08 | **Pagos** |
| 4 | k6 (100 usuarios, p95 < 2 s), Lighthouse | AC01/EQ-04 | Verificación final del catálogo |
| 5 | Pino + Sentry (o equivalente) y Toxiproxy | AC06, EQ-06/08 | Pedidos/Pagos |

## 7. Regularización de los módulos ya implementados

**Principio:** no se finge que existieron especificaciones previas. Cada especificación retroactiva lo declara así y parte de lo que realmente existe.

1. **Encabezado obligatorio:** `Tipo: Regularización (retroactiva)`. Origen: código, pruebas y `docs/05-implementacion/` del 2026-11-05. No es un requisito nuevo.
2. **Trazabilidad:** HU, RF, ADR y RC/AC/DA que cubre, citados sin reescribirlos. Si el comportamiento implementado difiere de la documentación, se registra como *Aclaración* con su justificación; no se altera el RF.
3. **Criterios de aceptación derivados de las pruebas existentes:** cada prueba unitaria, HTTP o de persistencia se enlaza con el criterio que verifica; lo implementado sin prueba se lista como hueco.
4. **Ejecución:** `/speckit-specify` (con instrucción explícita de redactar a partir del código) → `/speckit-clarify` → `/speckit-plan` documentando la estructura **actual** → `/speckit-tasks` solo con la **deuda**: huecos de prueba, límites entre módulos (§4) y requisitos parciales → `/speckit-analyze` → `/speckit-converge` para medir el código real contra la especificación.
5. **Alcance:** el plan no reimplementa nada; las únicas tareas son las de deuda. Las refactorizaciones de §4 se incluyen aquí, tras aprobar DEC-03.
6. **Agrupación:**

| Especificación | Módulos y frontend | Requisitos | Deuda principal |
|---|---|---|---|
| R1 · Identidad y usuarios | `auth`, `users`, `/login`, `/registro`, `/cuenta`, `/panel/usuarios` | RF01–RF05; HU20–HU21 | C-07, C-08, C-14 |
| R2 · Comerciantes y puestos | `merchants`, `/panel/comerciantes`, `/panel/puestos` | RF06–RF07; HU22 | C-16; API pública `PuestosApi` |
| R3 · Productos, categorías y catálogo | `products`, `catalog`, `/catalogo`, `/panel/productos`, `/panel/categorias` | RF09–RF11, RF16–RF19; HU01–HU03, HU12–HU13 | **C-05**, C-15, verificación real de Storage |

## 8. Orden recomendado de especificaciones

| Orden | Especificación | Requisitos | Depende de | Bloqueada por |
|---|---|---|---|---|
| 0 | Aprobar DEC-01…DEC-12 y registrar el ADR de pagos | — | — | Equipo |
| 1 | R1, R2 y R3 (regularización, §7) | ver §7 | DEC-03, DEC-06 | — |
| 2 | Infraestructura de calidad: CI, `dependency-cruiser` y base desechable | AC05, AC07 | DEC-07 | — |
| 3 | Auditoría | RF42; HU26 | R1–R3 | DEC-05 |
| 4 | Configuración operativa | RF45; HU24 | Auditoría | — |
| 5 | Permisos, trabajadores de puesto y tiendas virtuales | RF05, RF08; HU11 (sin vinculación), HU20 | R1, R2 | DEC-09, DEC-10 |
| 6 | Inventario | RF12–RF15; HU14–HU15; ADR-003 | Configuración, base desechable | — |
| 7 | Carrito | RF20–RF24; HU04–HU06 | Catálogo, Inventario | — |
| 8 | Pedidos | RF25–RF31, RF36–RF39, RF46; HU07, HU09, HU10, HU16, HU18, HU19 | Carrito, Inventario, Permisos | — |
| 9 | Pagos fase 1: cobro Sandbox, Webhook, idempotencia, conciliación y expiración | RF32–RF35, RF47–RF50, RF54; HU08, HU17; ADR-005 | Pedidos, Configuración | DEC-01, DEC-02 |
| 10 | Pagos fase 2: vinculación, distribución, comisiones y reembolsos | RF51–RF53, RF55; HU27–HU29 | Pagos fase 1 | DEC-01, DEC-02 |
| 11 | Incidencias, Notificaciones, Reportes y conciliación del administrador | RF40–RF41, RF43–RF44; HU23, HU25 | Pagos fase 2 | — |
| 12 | PWA | RC01; DA13 | — | Independiente |

## 9. Decisiones pendientes de aprobación

| ID | Decisión | Recomendación | Consecuencia si no se decide |
|---|---|---|---|
| DEC-01 | Modelo de distribución del pago único (§3.2) | **B**: pago único + distribución contable simulada | No se puede especificar `payments` |
| DEC-02 | Vinculación de cuentas: real (OAuth, tokens cifrados), simulada (indicador) o diferida | Simulada en la demostración; real solo con Split | RF52/HU27 sin criterios de aceptación |
| DEC-03 | Contratos públicos (`index.ts`, §4.2), tratamiento del catálogo (composición de APIs) y estructura de `auth`/`users` | Aprobar §4.2 | Se mantiene la deuda C-05 a C-08 |
| DEC-04 | Marcar ADR-001, 002, 003 y 005 como "Aceptada" | Sí | Autoridad ambigua (C-03) |
| DEC-05 | Prioridad de Auditoría (antes de Inventario) y registro interino | Especificar Auditoría en el paso 3 | Operaciones críticas sin trazabilidad |
| DEC-06 | Nombres docs↔código | Conservar el código y la equivalencia | Dos nomenclaturas |
| DEC-07 | Infraestructura de calidad por fases (§6) | Aprobar fases 1 y 2 de inmediato | AC07/AC03 no verificables |
| DEC-08 | Workflow SDD propio (§5.2) | Sí | El flujo de 8 etapas queda solo por disciplina |
| DEC-09 | Modelo de permisos y asignación de trabajadores | Especificarlo antes de Pedidos | RF36/RF39 sin base |
| DEC-10 | Entidad "tienda virtual" frente a página pública del puesto | Página del puesto en la primera versión | RF08/HU11 pendientes |
| DEC-11 | Versionar `.specify/` y `.claude/skills/`; ignorar `.agents/` y `.windsurf/`; carpeta `specs/` en la raíz | Sí | Herramientas sin compartir con el equipo |
| DEC-12 | Enmiendas editoriales a `docs/` (C-04, C-11, C-12) y ratificación de la constitución | Sí | Documentación desactualizada |

## 10. Cambios realizados en esta etapa

- `.specify/memory/constitution.md` v1.0.0 → **v1.1.0** (solo aspectos no controvertidos; D-001 retirada como decisión).
- `.specify/templates/plan-template.md`: compuerta VI actualizada y referencia a v1.1.0.
- Documento nuevo: este archivo.
- No se modificó código, `docs/01`–`docs/05`, `workflow.yml` ni migraciones; no hay commits, push ni merge.
