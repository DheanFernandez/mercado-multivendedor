# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Trazabilidad**: HU [HU..] · RF [RF..] · ADR [ADR-..] · RC/AC/DA [..] (copiar de la sección *Trazabilidad* de la especificación)

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [por defecto del proyecto: TypeScript (Node.js 24), NestJS 12 (ESM) y Next.js 16 / React 19]

**Primary Dependencies**: [por defecto: Prisma 7 + @prisma/adapter-pg, Supabase Auth/Storage, jose, Tailwind CSS 4; agregar solo lo que la funcionalidad requiera]

**Storage**: [por defecto: PostgreSQL en Supabase vía Prisma; Supabase Storage para archivos]

**Testing**: [por defecto: Vitest (unitarias `npm test`, HTTP `npm run test:e2e`, base de datos `npm run test:db`), `npm run build`, `npm run lint`]

**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]

**Project Type**: [aplicación web: `backend/` (monolito modular NestJS) + `frontend/` (Next.js)]

**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]

**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]

**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verificar contra `.specify/memory/constitution.md` (versión vigente; actualmente v1.1.1). Cada compuerta se marca ✅ cumple, ❌ viola (justificar en *Complexity Tracking*) o N/A (explicar):

- [ ] **I. Monolito modular**: el trabajo pertenece a un módulo nombrado de la aplicación NestJS única; sin servicios nuevos; contratos explícitos con otros módulos; sin importaciones de internos ajenos ni ciclos.
- [ ] **II. Clean Architecture**: capas `domain/`, `application/`, `infrastructure/`, `entry-adapters/`; dominio y aplicación sin NestJS/Prisma; casos de uso con puertos; controladores sin reglas; autorización en casos de uso.
- [ ] **III. Frontend**: Next.js/React/TypeScript sobre la API `/api/v1`; sin secretos en `NEXT_PUBLIC_*`; el ocultamiento por rol no es control de seguridad; importes sin `number` flotante.
- [ ] **IV. Persistencia**: Prisma + PostgreSQL; migración aditiva y revisada, con RLS, CHECK, FK e índices; `NUMERIC` para importes; sin migraciones destructivas ni `db push`.
- [ ] **V. Autenticación/autorización**: roles desde PostgreSQL; rutas privadas por defecto; roles permitidos declarados por operación; pruebas 401/403.
- [ ] **VI. Pagos (ADR-005)**: si aplica, pago único Sandbox, estado solo por Webhook verificado + API, idempotencia, `PasarelaPagoPort`; declara cuál de los cuatro conceptos (pago único, vinculación, distribución real, distribución simulada) trata y cita el ADR aprobado de DEC-01/DEC-02 (bloqueado mientras no exista).
- [ ] **VII. Inventario (ADR-003)**: si aplica, reservas atómicas condicionales en transacción corta, idempotencia, liberación idempotente, pruebas de concurrencia.
- [ ] **VIII. Seguridad**: sin secretos en Git ni logs; pruebas de acceso cruzado entre comerciantes y de rol no autorizado; entradas validadas; operaciones sin auditar declaradas.
- [ ] **IX. Calidad**: plan de pruebas unitarias, HTTP, de integración/persistencia, compilación y lint, ligado a los criterios de aceptación.
- [ ] **X. Trazabilidad**: HU/RF/ADR existentes en `docs/`; ambigüedades registradas como Aclaración/Decisión sin reescribir requisitos.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
