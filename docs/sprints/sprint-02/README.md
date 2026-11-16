# Sprint 02 · Diseño de la Arquitectura de Software y Evaluación de Atributos de Calidad

| Campo | Descripción |
|---|---|
| Curso | IS-488 Arquitectura de Software · UNSCH · 2026-II |
| Proyecto | Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos |
| Fecha del entregable | 16/11/2026 |
| Versión evaluada | `main` en el commit `1aab552`; el trabajo local de Pedidos, aún no publicado, se identifica siempre como «rama local» |
| Entregable principal | [Informe del Sprint 02](../../07-sprint-02/01-informe-sprint-02.md) |

> **Aviso.** Que la documentación esté completa **no significa** que todos los atributos de calidad estén validados. Ver §3.

## 1. Objetivo

Presentar el diseño de la arquitectura de software y evaluar, con evidencia verificable, si responde a los atributos de calidad priorizados en el Sprint 01.

## 2. Alcance y entregables

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

## 3. Estado de cumplimiento

| Medida | Resultado |
|---|---|
| Cobertura documental | **12 de 12** elementos de la entrega ([matriz de cumplimiento](../../07-sprint-02/01-informe-sprint-02.md#10-matriz-de-cumplimiento-de-la-entrega)) |
| Atributos de calidad satisfechos por completo | **Ninguno** |
| Satisfechos con reservas | **2**: rendimiento (AC01) y concurrencia (AC07) |
| Pendientes de verificación | **5**: seguridad, integridad y mantenibilidad (parciales); escalabilidad y disponibilidad (sin verificar) |

## 4. Evidencias verificables

| Fecha | Evidencia | Resultado | Ubicación |
|---|---|---|---|
| 05/11/2026 | EQ-03 · Concurrencia (Vitest y k6) | 0 reservas incompatibles en 400 de 400 iteraciones | [docs/05 · EQ-03](../../05-implementacion/evidencias/EQ-03/2026-11-05/README.md) |
| 05/11/2026 | EQ-04 · Rendimiento del catálogo (k6, 100 usuarios) | p95 = 381,4 ms (umbral: 2 000 ms), en entorno local | [docs/05 · EQ-04](../../05-implementacion/evidencias/EQ-04/2026-11-05/README.md) |
| 05/11/2026 | AC04 · Matriz de autorización rol × ruta | 198 de 198 casos conformes | [docs/05 · AC04](../../05-implementacion/evidencias/AC04/2026-11-05/README.md) |
| 05/11/2026 | Hito H0 · Compilación, lint y pruebas | 184 unitarias, 104 HTTP y 32 de base de datos aislada, todas en verde. Son verificaciones de calidad del código; no cuentan como mediciones EQ | [docs/05 · H0](../../05-implementacion/evidencias/H0-2026-11-05/resumen.md) |
| 16/11/2026 | AC04 · Matriz de autorización (repetición) | 252 de 252 casos conformes (42 rutas) | [docs/07 · evidencias](../../07-sprint-02/evidencias/2026-11-16/README.md) |
| 16/11/2026 | AC05 · Reglas de arquitectura sobre `main` | 0 violaciones (106 módulos) | [docs/07 · AC05 main](../../07-sprint-02/evidencias/2026-11-16/AC05-arquitectura-main/README.md) |

Cada evidencia declara su fecha, entorno, commit, herramienta, comando, resultado y limitaciones. El informe también verifica que los datos de cada una coinciden con lo que afirma ([evaluación §6](../../07-sprint-02/02-evaluacion-atributos-calidad.md#6-verificación-del-origen-de-las-evidencias)).

## 5. Relación con requisitos y arquitectura

La evaluación parte de los atributos, drivers y escenarios del Sprint 01. Los asocia a las decisiones (ADR) y tácticas que los atienden y los cierra con las pruebas reales. Lo hace en el [árbol de utilidad](../../07-sprint-02/02-evaluacion-atributos-calidad.md#3-árbol-de-utilidad) y en la [matriz de trazabilidad](../../07-sprint-02/03-matriz-de-trazabilidad.md).

## 6. Limitaciones y pendientes

- **Pagos.** El módulo de Pagos no existe todavía. Por eso no se pueden medir los dos escenarios de mayor prioridad (EQ-01 y EQ-08) ni el intercambio de adaptador (EQ-07).
- **Pedidos.** EQ-02 y la repetición de EQ-03 sobre «crear pedido» dependen de Pedidos, que está en desarrollo.
- **Entorno local.** Todas las mediciones son locales. Repetirlas en el entorno de producción es parte del [Sprint 03](../sprint-03/README.md).
- **Decisiones del equipo.** Los ADR siguen formalmente en «Propuesta» y las decisiones DEC-01 a DEC-12 están pendientes. Este sprint no aprueba ninguna.
- **Documentación original.** Los cambios que debe recibir están listados en el [informe, §11](../../07-sprint-02/01-informe-sprint-02.md#11-cambios-pendientes-en-la-documentación-original).
