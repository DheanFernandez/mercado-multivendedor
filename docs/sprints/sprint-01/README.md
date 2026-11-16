# Sprint 01 · Análisis y documentación inicial del sistema

| Campo | Descripción |
|---|---|
| Curso | IS-488 Arquitectura de Software · UNSCH · 2026-II |
| Proyecto | Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos |
| Versión entregada | Commit [`de02b2b`](https://github.com/DheanFernandez/mercado-multivendedor/tree/de02b2b38e6b65c77c1152ebd6ae875e30f58ccf/docs) (29/10/2026). El cierre documental del sprint está en [`1058e73`](https://github.com/DheanFernandez/mercado-multivendedor/commit/1058e7382e260756265ddc932bfd3b9534452273) (25/10/2026) |
| Estado | Entregado. Los documentos se actualizaron después (ver §3) |

## 1. Objetivo

Analizar el problema del mercado de abastos y documentar la base del sistema: quiénes lo usan, qué debe hacer, qué atributos de calidad y restricciones lo condicionan, qué drivers arquitectónicos se derivan de ellos y qué decisiones iniciales de arquitectura y diseño responden a esos drivers.

## 2. Alcance y entregables

Los enlaces llevan a la **versión vigente** de cada documento. La versión exacta entregada en este sprint está en el commit indicado arriba.

| Entregable | Documento | Contenido |
|---|---|---|
| Análisis del sistema (problema, objetivo y alcance) | [README del proyecto](../../../README.md) | Problema, objetivo, actores principales y alcance; sin delivery ni app móvil nativa |
| Actores y usuarios | [01-actores.md](../../01-analisis-de-sistema/01-actores.md) | 4 actores (cliente, comerciante, trabajador de puesto, administrador) y los sistemas externos |
| Historias de usuario | [02-historias-de-usuario.md](../../01-analisis-de-sistema/02-historias-de-usuario.md) | HU01–HU29 y la diferencia entre historia, acción y requisito |
| Requisitos funcionales | [03-requisitos-funcionales.md](../../01-analisis-de-sistema/03-requisitos-funcionales.md) | RF01–RF55 y la relación HU → RF |
| Requisitos no funcionales | [04-atributos-de-calidad.md](../../01-analisis-de-sistema/04-atributos-de-calidad.md) y [05-restricciones.md](../../01-analisis-de-sistema/05-restricciones.md) | El proyecto no tiene un documento de «requisitos no funcionales»: se expresan como atributos de calidad (AC01–AC12) y restricciones (RC01–RC20) |
| Restricciones | [05-restricciones.md](../../01-analisis-de-sistema/05-restricciones.md) | Tecnológicas, organizacionales y de alcance |
| Atributos de calidad y escenarios | [04-atributos-de-calidad.md](../../01-analisis-de-sistema/04-atributos-de-calidad.md), [08-escenarios-atributos-calidad.md](../../01-analisis-de-sistema/08-escenarios-atributos-calidad.md) | 7 atributos prioritarios con criterios de evaluación; escenarios EQ-01 a EQ-08 con medida y herramientas |
| Drivers arquitectónicos | [06-drivers-arquitectonicos.md](../../01-analisis-de-sistema/06-drivers-arquitectonicos.md) | DA01–DA14 y su trazabilidad hacia las decisiones |
| Decisiones arquitectónicas | [07-decisiones-arquitectonicas.md](../../01-analisis-de-sistema/07-decisiones-arquitectonicas.md) y [ADR](../../01-analisis-de-sistema/decisiones/) | En este sprint: ADR-001 a ADR-004 |
| Arquitectura inicial | [arquitectura-inicial.md](../../02-arquitectura-software/arquitectura-inicial.md), [estilo-arquitectonico.md](../../02-arquitectura-software/estilo-arquitectonico.md), [enfoque-arquitectonico.md](../../02-arquitectura-software/enfoque-arquitectonico.md), [componentes-arquitectonicos.md](../../02-arquitectura-software/componentes-arquitectonicos.md) | Estilo, organización interna, componentes y priorización de módulos |
| Diseño de software | [diseño interno](../../03-diseño-de-software/diseño-interno/diseño-interno-de-modulos.md), [patrones](../../03-diseño-de-software/diseño-interno/patrones-de-diseño.md), [SOLID](../../03-diseño-de-software/diseño-interno/principios-de-diseño.md) | Estructura interna de un módulo, patrones y principios |
| Diagramas C4 | [Nivel 1](../../04-modelo-c4/Nivel1-DiagramadeContextodelSistema.md), [Nivel 2](../../04-modelo-c4/Nivel2-DiagramadeContenedores.md), [Nivel 3](../../04-modelo-c4/Nivel3-Diagrama-de-Componentes.md), [Nivel 4](../../04-modelo-c4/Nivel4-DiagramadeCodigo.md) | Contexto, contenedores, componentes y código |

## 3. Versión entregada y cambios posteriores

El 04/11/2026, después de la entrega, la documentación se refactorizó: commit [`0257c2e`](https://github.com/DheanFernandez/mercado-multivendedor/commit/0257c2e5182eb71108e76d20010c54f7e8b252db), integrado en `main` con el *pull request* #2. Ese cambio tocó 25 archivos. Las diferencias principales:

| Tema | Versión entregada en el Sprint 01 (`de02b2b`) | Versión vigente |
|---|---|---|
| Estilo arquitectónico | «Cliente-servidor de tres capas» como estilo principal, con monolito modular (ADR-001) | Monolito modular como **único** estilo; Clean Architecture solo como organización interna |
| Pagos | Pago por QR (Yape o Plin) por puesto con validación manual (ADR-004) | Pago único por pedido con Mercado Pago Sandbox ([ADR-005](../../01-analisis-de-sistema/decisiones/ADR-005-pago-unico-mercado-pago.md)); ADR-004 queda como «Reemplazado» |

Para evaluar exactamente lo entregado conviene revisar el [árbol de `docs/` en `de02b2b`](https://github.com/DheanFernandez/mercado-multivendedor/tree/de02b2b38e6b65c77c1152ebd6ae875e30f58ccf/docs).

## 4. Estado de cumplimiento

| Elemento | Estado en la versión entregada |
|---|---|
| Actores, historias de usuario y requisitos funcionales | Completo |
| Atributos de calidad, restricciones y drivers | Completo |
| Escenarios de calidad con medida y herramientas | Completo como especificación. Ninguna medición se había ejecutado: el código no existía |
| Decisiones (ADR-001 a ADR-004) | Documentadas, en estado «Propuesta» |
| Arquitectura inicial, diseño y C4 de los cuatro niveles | Completo |

En este sprint no había código: el backend y el frontend se iniciaron el 05/11/2026.

## 5. Evidencias verificables

Las evidencias del Sprint 01 son **documentales**: no hay pruebas ni mediciones de esta etapa.

| Evidencia | Dónde está | Desde |
|---|---|---|
| Relación entre historias de usuario y requisitos funcionales | [03-requisitos-funcionales.md](../../01-analisis-de-sistema/03-requisitos-funcionales.md#relación-entre-historias-de-usuario-y-requisitos-funcionales) | Sprint 01 |
| Ejemplo historia → acción → requisito | [02-historias-de-usuario.md](../../01-analisis-de-sistema/02-historias-de-usuario.md#historia-de-usuario-acción-y-requisito-funcional) | `1058e73` |
| Trazabilidad entre drivers y decisiones | [06-drivers-arquitectonicos.md](../../01-analisis-de-sistema/06-drivers-arquitectonicos.md#trazabilidad-entre-drivers-y-decisiones-arquitectónicas) | Sprint 01 |
| Verificación de coherencia documental (HU frente a RF, RF frente a módulos, drivers frente a ADR, C4 frente al diseño) | [componentes-arquitectonicos.md §5](../../02-arquitectura-software/componentes-arquitectonicos.md#5-verificación-de-coherencia-documental) | `1058e73` |
| Herramientas de medición previstas por escenario | [08-escenarios-atributos-calidad.md](../../01-analisis-de-sistema/08-escenarios-atributos-calidad.md#resumen-de-medición) | `de02b2b` |

## 6. Relación con requisitos y arquitectura

Este sprint fija la cadena que usan los siguientes: **requisitos y atributos → drivers → decisiones (ADR) → estilo y componentes → C4**. El Sprint 02 evalúa esa arquitectura con evidencias, y el Sprint 03 la despliega. La cadena completa, hasta las pruebas, está en la [matriz de trazabilidad del Sprint 02](../../07-sprint-02/03-matriz-de-trazabilidad.md).

## 7. Limitaciones y pendientes

- La propia versión entregada dejaba pendientes las decisiones complementarias de DA03 (seguridad), DA10 (auditoría) y DA11 (aislamiento de fallos), y el vínculo de RF41 con una historia de usuario.
- Los ADR siguen formalmente en estado «Propuesta» (decisión DEC-04 pendiente).
- Las discrepancias que la documentación original arrastra se registran en el [informe del Sprint 02, §11](../../07-sprint-02/01-informe-sprint-02.md#11-cambios-pendientes-en-la-documentación-original).
