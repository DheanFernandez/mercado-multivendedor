# Sprint 02 · Implementación y Validación de la Arquitectura de Software

| Campo | Descripción |
|---|---|
| Curso | IS-488 Arquitectura de Software · UNSCH · 2026-II |
| Proyecto | Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos |
| Fecha de la entrega final | 18/11/2026 (la parte de diseño se entregó el 16/11/2026; véase el [Anexo A](#anexo-a--entrega-de-diseño-del-16112026-conservada)) |
| Versión evaluada | `origin/main` en **`200675c`** (merge del PR #12). Contiene Frontend (#9), Demo (#10), Swagger/OpenAPI (#11), Jest, cobertura y CI (#12). El trabajo local de Pedidos, no publicado, queda fuera |
| Entregable principal | [Informe final del Sprint 02](../../07-sprint-02/04-informe-final-sprint-02.md) |
| Matriz de cumplimiento | [Matriz oficial](../../07-sprint-02/05-matriz-oficial-de-cumplimiento.md) |
| Evidencias | [Evidencias del 18/11/2026](../../07-sprint-02/evidencias/2026-11-18/README.md) |
| Actualización (2026-11-23) | Actualización 2026-11-23: la spec 001 se completó con [`plan.md`](../../../specs/001-inventario/plan.md) y [`tasks.md`](../../../specs/001-inventario/tasks.md) (27 de 28 tareas; T028 bloqueada por Pedidos); evidencia de `test:db` en [`evidencias/2026-11-23/inventario/`](../../07-sprint-02/evidencias/2026-11-23/inventario/README.md). La versión evaluada del informe sigue siendo `200675c`. |

> **Aviso.** Que haya una primera versión funcional, pruebas en verde y documentación completa **no significa** que todos los atributos de calidad estén validados ni que el flujo de compra esté implementado. Pedidos y Pagos no forman parte del incremento. Véase el §3.

## 1. Los cinco entregables

| # | Entregable | Estado | Resumen | Dónde |
|---|---|---|---|---|
| 1 | Código organizado según la arquitectura | **Cumplido** (módulos implementados) | Monolito modular con cuatro anillos por módulo; 0 violaciones de dependencia en 111 módulos | [Informe §4](../../07-sprint-02/04-informe-final-sprint-02.md#4-implementación-de-la-arquitectura) y [§5](../../07-sprint-02/04-informe-final-sprint-02.md#5-clean-architecture-y-solid-en-el-código) |
| 2 | Primera versión funcional | **Parcial** | Catálogo validado de extremo a extremo; carrito validado por **API real** (no desde una sesión de Supabase); sin Pedidos ni Pagos | [Informe §3 y §10](../../07-sprint-02/04-informe-final-sprint-02.md#3-alcance-de-la-primera-versión-funcional) |
| 3 | API REST con OpenAPI/Swagger | **Cumplido** en rutas, seguridad y parámetros | 42 rutas (6 públicas, 36 protegidas); Swagger UI en `/api/docs`; esquemas de cuerpo y respuesta manuales | [Informe §7](../../07-sprint-02/04-informe-final-sprint-02.md#7-api-rest-y-swaggeropenapi) |
| 4 | Pruebas con Jest y cobertura | **Cumplido con limitaciones** | Jest 88/88 (selección); Vitest 338 unitarias + 132 HTTP; cobertura global 73,52 / 70,73 / 78,07 / 76,01 % (sin `test:db`) | [Informe §8](../../07-sprint-02/04-informe-final-sprint-02.md#8-pruebas-con-jest-y-cobertura) |
| 5 | Validación de atributos de calidad | **Parcial** | 0 atributos satisfechos por completo; AC04 252/252 y AC05 0 violaciones repetidos sobre `200675c`; EQ-03 y EQ-04 del 05/11 | [Informe §9](../../07-sprint-02/04-informe-final-sprint-02.md#9-validación-de-atributos-de-calidad) · [Base de datos y caché](../../05-implementacion/05-base-de-datos-y-cache.md) |

El CI de GitHub Actions pasó en el PR #12 y en el merge, con Jest, cobertura y Vitest del frontend ([resumen](../../07-sprint-02/evidencias/2026-11-18/ci/resumen-ci.txt)).

## 2. Documentos del sprint

| Documento | Contenido | Versión |
|---|---|---|
| [04 · Informe final](../../07-sprint-02/04-informe-final-sprint-02.md) | Resumen, arquitectura implementada, Clean Architecture y SOLID, SDD, API, pruebas y cobertura, calidad, evidencias, limitaciones y conclusiones | `200675c` (18/11/2026) |
| [05 · Matriz oficial de cumplimiento](../../07-sprint-02/05-matriz-oficial-de-cumplimiento.md) | Entregable → requisito → implementación → prueba → resultado → evidencia | `200675c` |
| [Evidencias del 18/11/2026](../../07-sprint-02/evidencias/2026-11-18/README.md) | Capturas, flujos reales, Jest, cobertura, AC04, CI | `200675c` |
| [01 · Informe de diseño](../../07-sprint-02/01-informe-sprint-02.md) | Diseño arquitectónico, C4, ADR y evaluación inicial (**conservado**) | `1aab552` (16/11/2026) |
| [02 · Evaluación de atributos de calidad](../../07-sprint-02/02-evaluacion-atributos-calidad.md) | Método ATAM adaptado, tácticas, escenarios y riesgos (**conservado**) | `1aab552` |
| [03 · Matriz de trazabilidad](../../07-sprint-02/03-matriz-de-trazabilidad.md) | RF → HU → driver → ADR → componente → prueba (**conservada**) | `1aab552` |
| [Evidencias del 16/11/2026](../../07-sprint-02/evidencias/2026-11-16/README.md) | AC04, AC05 y pruebas unitarias de esa fecha (**conservadas**) | `1aab552` y rama local |

Especificaciones SDD relacionadas: [001](../../../specs/001-inventario/spec.md) (con `spec.md` al 18/11/2026; completada el 2026-11-23 con plan y tareas, 27 de 28, T028 bloqueada por Pedidos: [tasks.md](../../../specs/001-inventario/tasks.md), [evidencia](../../07-sprint-02/evidencias/2026-11-23/inventario/README.md)), [002](../../../specs/002-carrito/spec.md), [004](../../../specs/004-catalogo-publico/spec.md), [005](../../../specs/005-openapi-swagger/spec.md) y [006](../../../specs/006-pruebas-cobertura/spec.md).

## 3. Limitaciones y decisiones pendientes

- **Sin Supabase Auth en la demostración:** el inicio de sesión, el registro y el panel no se probaron en el navegador; el carrito se validó por API con un token firmado localmente.
- **Pedidos y Pagos** no están implementados en `main`; EQ-01, EQ-02 y EQ-08 no son medibles.
- **Jest** cubre una selección (10 archivos); la **cobertura global** es de Vitest y **no incluye `test:db`**.
- **El contrato OpenAPI no es exhaustivo** (cuerpos y respuestas manuales). **No hay fotografías reales** de productos.
- **EQ-03 y EQ-04** son del 05/11/2026 y no se repitieron. Todas las mediciones son locales.
- **Carga hasta 2000 VUs medida el 25/11/2026 (veredicto parcial):** rampa 0→2000 VUs, 0 % de errores; p95 < 2 s solo hasta ≈ 500 VUs y p95 = 11,4 s con 2000 sostenidos ([evidencia](../../07-sprint-02/evidencias/2026-11-25/k6-rampa-2000/README.md)). Una sola ejecución, en máquina local con k6, backend y base en el mismo equipo; no extrapolable a Render/Supabase. La medición de criterio de EQ-04 (100 VUs constantes: p95 = 381,4 ms) es del 05/11 ([EQ-04](../../05-implementacion/evidencias/EQ-04/2026-11-05/README.md)).
- **Módulos sin spec propia:** `auth`, `users`, `merchants` y `products` se implementaron **antes de adoptar SDD** y no tienen spec propia; su regularización está en la [matriz de regularización](../../06-gobernanza-sdd/05-matriz-de-regularizacion.md).
- **Sin caché:** la estrategia de caché no se implementó; solo existe como propuesta en [05 · Base de datos y caché](../../05-implementacion/05-base-de-datos-y-cache.md).
- **Decisiones para el equipo y la docente:** confirmar que Vitest como ejecutor principal con Jest adicional satisface el requisito; autorizar un Supabase de desarrollo para la demostración completa; política de Swagger en producción; ADR y DEC-01 a DEC-12 pendientes. Detalle en el [informe §11 y §12](../../07-sprint-02/04-informe-final-sprint-02.md#11-limitaciones).

---

## Anexo A · Entrega de diseño del 16/11/2026 (conservada)

> Texto original de la portada del 16/11/2026, **sin cambios de contenido** (solo se bajó un nivel a sus títulos). Describe la versión `1aab552`; sus cifras y su estado corresponden a esa fecha. Los resultados vigentes están en las secciones anteriores.

| Campo | Descripción |
|---|---|
| Curso | IS-488 Arquitectura de Software · UNSCH · 2026-II |
| Proyecto | Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos |
| Fecha del entregable | 16/11/2026 |
| Versión evaluada | `main` en el commit `1aab552`; el trabajo local de Pedidos, aún no publicado, se identifica siempre como «rama local» |
| Entregable principal | [Informe del Sprint 02](../../07-sprint-02/01-informe-sprint-02.md) |

> **Aviso.** Que la documentación esté completa **no significa** que todos los atributos de calidad estén validados. Ver §3.

### 1. Objetivo

Presentar el diseño de la arquitectura de software y evaluar, con evidencia verificable, si responde a los atributos de calidad priorizados en el Sprint 01.

### 2. Alcance y entregables

El entregable del sprint está en [`docs/07-sprint-02/`](../../07-sprint-02/) y se mantiene sin cambios. Esta portada solo lo indexa.

| Documento | Contenido |
|---|---|
| [01 · Informe del Sprint 02](../../07-sprint-02/01-informe-sprint-02.md) | Resumen, diseño arquitectónico, C4, ADR, atributos y escenarios, evaluación, riesgos, trazabilidad, matriz de cumplimiento, cambios pendientes y conclusiones |
| [02 · Evaluación de atributos de calidad](../../07-sprint-02/02-evaluacion-atributos-calidad.md) | Método (adaptado de ATAM), árbol de utilidad, 25 tácticas, análisis por escenario (sensibilidad, compromisos, riesgos), verificación del origen de las evidencias y resultados por atributo |
| [03 · Matriz de trazabilidad](../../07-sprint-02/03-matriz-de-trazabilidad.md) | Cadena RF → HU → driver → ADR → componente → escenario → prueba → estado, para los 13 módulos y los requisitos críticos |
| [Evidencias del 16/11/2026](../../07-sprint-02/evidencias/2026-11-16/README.md) | Verificaciones ejecutadas durante la evaluación |

**Documentación de diseño en la que se apoya** (compartida con el Sprint 01, en su versión vigente):

- Estilo y organización interna: [estilo](../../02-arquitectura-software/estilo-arquitectonico.md), [Clean Architecture](../../02-arquitectura-software/enfoque-arquitectonico.md), [componentes](../../02-arquitectura-software/componentes-arquitectonicos.md).
- Decisiones: [ADR-001 a ADR-005](../../01-analisis-de-sistema/decisiones/).
- Modelo C4: [niveles 1 a 4](../../04-modelo-c4/).
- Diseño interno: [módulos](../../03-diseño-de-software/diseño-interno/diseño-interno-de-modulos.md) y [patrones](../../03-diseño-de-software/diseño-interno/patrones-de-diseño.md).

### 3. Estado de cumplimiento

| Medida | Resultado |
|---|---|
| Cobertura documental | **12 de 12** elementos de la entrega ([matriz de cumplimiento](../../07-sprint-02/01-informe-sprint-02.md#10-matriz-de-cumplimiento-de-la-entrega)) |
| Atributos de calidad satisfechos por completo | **Ninguno** |
| Satisfechos con reservas | **2**: rendimiento (AC01) y concurrencia (AC07) |
| Pendientes de verificación | **5**: seguridad, integridad y mantenibilidad (parciales); escalabilidad y disponibilidad (sin verificar) |

### 4. Evidencias verificables

| Fecha | Evidencia | Resultado | Ubicación |
|---|---|---|---|
| 05/11/2026 | EQ-03 · Concurrencia (Vitest y k6) | 0 reservas incompatibles en 400 de 400 iteraciones | [docs/05 · EQ-03](../../05-implementacion/evidencias/EQ-03/2026-11-05/README.md) |
| 05/11/2026 | EQ-04 · Rendimiento del catálogo (k6, 100 usuarios) | p95 = 381,4 ms (umbral: 2 000 ms), en entorno local | [docs/05 · EQ-04](../../05-implementacion/evidencias/EQ-04/2026-11-05/README.md) |
| 05/11/2026 | AC04 · Matriz de autorización rol × ruta | 198 de 198 casos conformes | [docs/05 · AC04](../../05-implementacion/evidencias/AC04/2026-11-05/README.md) |
| 05/11/2026 | Hito H0 · Compilación, lint y pruebas | 184 unitarias, 104 HTTP y 32 de base de datos aislada, todas en verde. Son verificaciones de calidad del código; no cuentan como mediciones EQ | [docs/05 · H0](../../05-implementacion/evidencias/H0-2026-11-05/resumen.md) |
| 16/11/2026 | AC04 · Matriz de autorización (repetición) | 252 de 252 casos conformes (42 rutas) | [docs/07 · evidencias](../../07-sprint-02/evidencias/2026-11-16/README.md) |
| 16/11/2026 | AC05 · Reglas de arquitectura sobre `main` | 0 violaciones (106 módulos) | [docs/07 · AC05 main](../../07-sprint-02/evidencias/2026-11-16/AC05-arquitectura-main/README.md) |

Cada evidencia declara su fecha, entorno, commit, herramienta, comando, resultado y limitaciones. El informe también verifica que los datos de cada una coinciden con lo que afirma ([evaluación §6](../../07-sprint-02/02-evaluacion-atributos-calidad.md#6-verificación-del-origen-de-las-evidencias)).

### 5. Relación con requisitos y arquitectura

La evaluación parte de los atributos, drivers y escenarios del Sprint 01. Los asocia a las decisiones (ADR) y tácticas que los atienden y los cierra con las pruebas reales. Lo hace en el [árbol de utilidad](../../07-sprint-02/02-evaluacion-atributos-calidad.md#3-árbol-de-utilidad) y en la [matriz de trazabilidad](../../07-sprint-02/03-matriz-de-trazabilidad.md).

### 6. Limitaciones y pendientes

- **Pagos.** El módulo de Pagos no existe todavía. Por eso no se pueden medir los dos escenarios de mayor prioridad (EQ-01 y EQ-08) ni el intercambio de adaptador (EQ-07).
- **Pedidos.** EQ-02 y la repetición de EQ-03 sobre «crear pedido» dependen de Pedidos, que está en desarrollo.
- **Entorno local.** Todas las mediciones son locales. Repetirlas en el entorno de producción es parte del [Sprint 03](../sprint-03/README.md).
- **Decisiones del equipo.** Los ADR siguen formalmente en «Propuesta» y las decisiones DEC-01 a DEC-12 están pendientes. Este sprint no aprueba ninguna.
- **Documentación original.** Los cambios que debe recibir están listados en el [informe, §11](../../07-sprint-02/01-informe-sprint-02.md#11-cambios-pendientes-en-la-documentación-original).
