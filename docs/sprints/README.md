# Entregables académicos · IS-488 Arquitectura de Software

Índice de las tres entregas del curso (UNSCH, semestre 2026-II) para el proyecto **Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos**.

Cada sprint tiene una portada que explica su objetivo, su alcance, su estado y dónde está cada documento y cada evidencia. Las portadas **no duplican** la documentación: enlazan a los documentos originales, que siguen en sus carpetas (`docs/01` a `docs/07`).

| Sprint | Entrega | Estado | Portada |
|---|---|---|---|
| 01 | Análisis y documentación inicial del sistema | Entregado (versión de cierre: 29/10/2026) | [sprint-01](sprint-01/README.md) |
| 02 | Diseño de la arquitectura de software y evaluación de atributos de calidad | Integrado en `main` (*pull request* #7, 16/11/2026) | [sprint-02](sprint-02/README.md) |
| 03 | Despliegue de la solución software en un entorno de producción | **No iniciado**: solo existe la estructura documental | [sprint-03](sprint-03/README.md) |

## Cómo está organizada la documentación

| Carpeta | Contenido | Sprints que la usan |
|---|---|---|
| [`01-analisis-de-sistema`](../01-analisis-de-sistema/) | Actores, historias de usuario, requisitos, atributos de calidad, restricciones, drivers, escenarios y ADR | 01, 02 y 03 |
| [`02-arquitectura-software`](../02-arquitectura-software/) | Arquitectura inicial, estilo, organización interna (Clean Architecture) y componentes | 01 y 02 |
| [`03-diseño-de-software`](../03-diseño-de-software/) | Diseño interno de módulos, patrones y principios SOLID | 01 y 02 |
| [`04-modelo-c4`](../04-modelo-c4/) | Diagramas C4 de los niveles 1 a 4 | 01, 02 y 03 |
| [`05-implementacion`](../05-implementacion/) | Notas de lo implementado, matrices de cumplimiento y mediciones, evidencias de pruebas | 02 y 03 |
| [`06-gobernanza-sdd`](../06-gobernanza-sdd/) | Revisión de consistencia, decisiones pendientes (DEC-01 a DEC-12) y contratos entre módulos | 02 |
| [`07-sprint-02`](../07-sprint-02/) | Informe, evaluación y trazabilidad del Sprint 02 | 02 |
| `sprints/` | Estas portadas | Todas |

Los documentos de `docs/01` a `docs/04` evolucionan: describen la arquitectura **vigente**, no la de cada entrega. Cuando una entrega se hizo sobre una versión anterior, su portada enlaza también al commit correspondiente.
