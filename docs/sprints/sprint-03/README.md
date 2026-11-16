# Sprint 03 · Despliegue de la Solución Software en un Entorno de Producción

| Campo | Descripción |
|---|---|
| Curso | IS-488 Arquitectura de Software · UNSCH · 2026-II |
| Proyecto | Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos |
| Estado | **No iniciado.** La aplicación **no está desplegada** en ningún entorno público. Esta carpeta contiene solo la estructura documental |
| Restricción que atiende | RC20: «La solución deberá poder desplegarse y ser accesible públicamente mediante Internet» ([restricciones](../../01-analisis-de-sistema/05-restricciones.md)) |

## 1. Objetivo

Desplegar la plataforma en un entorno de producción accesible por Internet, de forma reproducible y segura, y comprobar con evidencias que funciona y que los atributos de calidad medidos en local se mantienen en ese entorno.

## 2. Alcance y entregables

| # | Documento | Contenido previsto | Estado |
|---|---|---|---|
| 01 | [Arquitectura de despliegue](01-arquitectura-de-despliegue.md) | Dónde se ejecuta cada componente y cómo se comunican en producción | Plantilla |
| 02 | [Infraestructura y ambientes](02-infraestructura-y-ambientes.md) | Ambientes (desarrollo, pruebas, integración continua, producción) y sus requisitos | Plantilla con los ambientes existentes |
| 03 | [Configuración y seguridad](03-configuracion-y-seguridad.md) | Variables de entorno, secretos y medidas de seguridad | Plantilla con las variables existentes |
| 04 | [Procedimiento de despliegue](04-procedimiento-de-despliegue.md) | Pasos reproducibles, verificación y reversión | Plantilla |
| 05 | [Pruebas de funcionamiento en producción](05-pruebas-en-produccion.md) | Pruebas de humo y repetición de las mediciones | Plantilla |
| 06 | [Resultados, riesgos y limitaciones](06-resultados-riesgos-y-limitaciones.md) | Resultados obtenidos y riesgos del despliegue | Plantilla con los riesgos conocidos |
| — | [Evidencias](evidencias/README.md) | Registros de despliegue y de pruebas | Sin evidencias |

## 3. Estado de cumplimiento

| Elemento | Estado | Base existente |
|---|---|---|
| Integración continua | **Existe (no es despliegue).** Compila, revisa estilo y reglas de arquitectura y ejecuta pruebas en cada *pull request* | [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) |
| Configuración por variables de entorno | Existe | [`backend/.env.example`](../../../backend/.env.example), [`frontend/.env.example`](../../../frontend/.env.example) |
| Migraciones de base de datos versionadas | Existen (Prisma) | [`backend/prisma/migrations/`](../../../backend/prisma/migrations/) |
| Proveedor de alojamiento del frontend y del backend | **No decidido** | — |
| Despliegue continuo (CD), contenedores o infraestructura como código | **No existen** | — |
| Despliegue en producción | **No realizado** | — |
| Pruebas en producción | **No realizadas** | — |

## 4. Evidencias verificables

Todavía no hay evidencias de este sprint. La estructura prevista está en [evidencias/README.md](evidencias/README.md).

## 5. Relación con requisitos y arquitectura

- **Contenedores que se despliegan.** Son los del [C4 nivel 2](../../04-modelo-c4/Nivel2-DiagramadeContenedores.md): la aplicación web (Next.js), la API del monolito modular (NestJS) y la base de datos PostgreSQL en Supabase. Se integran con Supabase Auth, Supabase Storage y, cuando exista el módulo de Pagos, Mercado Pago Sandbox.
- **Una sola unidad desplegable.** ADR-001 y RC11 exigen que la lógica de negocio se despliegue como una única aplicación; el despliegue no debe separar los módulos en servicios.
- **Mediciones pendientes del Sprint 02.** Repetir EQ-04 (rendimiento) en producción y medir la disponibilidad (AC03) corresponde a este sprint ([informe del Sprint 02](../../07-sprint-02/01-informe-sprint-02.md#7-evaluación-basada-en-evidencia)).
- **Plan del hito H7.** El hito H7 de los [pendientes priorizados](../../05-implementacion/cumplimiento/02-pendientes-priorizados.md) ya preveía el despliegue público, la PWA mínima y la medición EQ-05.

## 6. Limitaciones y pendientes

- La elección del proveedor de alojamiento es una **decisión arquitectónica pendiente**: debería registrarse en un ADR antes de desplegar.
- El módulo de Pagos no existe. El Webhook de Mercado Pago necesitará una URL pública HTTPS del backend desplegado.
- El módulo de Pedidos está en desarrollo y no está integrado en `main`.
- Esta carpeta no contiene URLs públicas ni credenciales, y no debe contenerlas: los secretos se gestionan fuera del repositorio.
