# Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos

## Integrantes

- Fernandez Pillman Dhean Jhoner
- Gómez Prado Ederson

## Descripción

Proyecto académico orientado al diseño y desarrollo de una plataforma web multivendedor para un mercado de abastos.

La plataforma permitirá integrar comerciantes, puestos comerciales, productos, inventarios, clientes, pedidos y pagos dentro de un único sistema.

Cada comerciante podrá administrar de manera independiente la información de su puesto, productos, precios e inventario, mientras que los clientes podrán consultar y adquirir productos ofrecidos por diferentes comerciantes mediante un marketplace común.

Los clientes pagarán a cada puesto mediante Yape o Plin y retirarán sus productos directamente en los puestos correspondientes. La plataforma no incluye servicio de delivery.

## Objetivo

Diseñar una arquitectura de software modular, segura y escalable que permita centralizar los principales procesos comerciales y operativos de un mercado de abastos.

## Tipo de arquitectura

Arquitectura cliente-servidor de tres capas con enfoque modular.

### Capa de presentación

Aplicación Web/PWA desarrollada con Next.js y TypeScript.

### Capa de lógica de negocio

Backend/API desarrollado con NestJS y TypeScript.

### Capa de datos

PostgreSQL mediante Supabase para la información estructurada y Supabase Storage o Cloudflare R2 para imágenes, documentos y otros archivos.

## Curso

Arquitectura de Software - IS488

## Semestre

2026-II

## Documentación de Arquitectura de Software

El proyecto desarrolla progresivamente el análisis y diseño arquitectónico de la Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos.

```text
docs/
├── 01-analisis-de-sistema/
│   └── decisiones/            ADR-001 a ADR-004
├── 02-arquitectura-software/
├── 03-diseño-de-software/
│   └── diseño-interno/
└── 04-modelo-c4/
```

### 01. Análisis del sistema

| Documento | Enlace |
|---|---|
| Actores del sistema | [Ver documento](docs/01-analisis-de-sistema/01-actores.md) |
| Historias de usuario | [Ver documento](docs/01-analisis-de-sistema/02-historias-de-usuario.md) |
| Requisitos funcionales | [Ver documento](docs/01-analisis-de-sistema/03-requisitos-funcionales.md) |
| Atributos de calidad | [Ver documento](docs/01-analisis-de-sistema/04-atributos-de-calidad.md) |
| Restricciones arquitectónicas | [Ver documento](docs/01-analisis-de-sistema/05-restricciones.md) |
| Drivers arquitectónicos | [Ver documento](docs/01-analisis-de-sistema/06-drivers-arquitectonicos.md) |
| Decisiones arquitectónicas (resumen) | [Ver documento](docs/01-analisis-de-sistema/07-decisiones-arquitectonicas.md) |
| Escenarios de atributos de calidad | [Ver documento](docs/01-analisis-de-sistema/08-escenarios-atributos-calidad.md) |
| ADR-001: Monolito modular | [Ver documento](docs/01-analisis-de-sistema/decisiones/ADR-001-monolito-modular.md) |
| ADR-002: Clean Architecture | [Ver documento](docs/01-analisis-de-sistema/decisiones/ADR-002-clean-architecture.md) |
| ADR-003: Control de concurrencia | [Ver documento](docs/01-analisis-de-sistema/decisiones/ADR-003-control-concurrencia.md) |
| ADR-004: Pagos mediante QR | [Ver documento](docs/01-analisis-de-sistema/decisiones/ADR-004-pagos-qr.md) |

### 02. Arquitectura de software

| Documento | Enlace |
|---|---|
| Arquitectura inicial y diagrama | [Ver documento](docs/02-arquitectura-software/arquitectura-inicial.md) |
| Estilo arquitectónico | [Ver documento](docs/02-arquitectura-software/estilo-arquitectonico.md) |
| Enfoque Clean Architecture | [Ver documento](docs/02-arquitectura-software/enfoque-arquitectonico.md) |
| Componentes arquitectónicos | [Ver documento](docs/02-arquitectura-software/componentes-arquitectonicos.md) |

### 03. Diseño de software

| Documento | Enlace |
|---|---|
| Diseño interno de módulos | [Ver documento](docs/03-diseño-de-software/diseño-interno/diseño-interno-de-modulos.md) |
| Patrones de diseño | [Ver documento](docs/03-diseño-de-software/diseño-interno/patrones-de-diseño.md) |
| Principios de diseño (SOLID) | [Ver documento](docs/03-diseño-de-software/diseño-interno/principios-de-diseño.md) |

### 04. Modelo C4

| Documento | Enlace |
|---|---|
| Nivel 1 · Diagrama de contexto | [Ver documento](docs/04-modelo-c4/Nivel1-DiagramadeContextodelSistema.md) |
| Nivel 2 · Diagrama de contenedores | [Ver documento](docs/04-modelo-c4/Nivel2-DiagramadeContenedores.md) |
| Nivel 3 · Diagrama de componentes | [Ver documento](docs/04-modelo-c4/Nivel3-Diagrama-de-Componentes.md) |
| Nivel 4 · Diagrama de código | [Ver documento](docs/04-modelo-c4/Nivel4-DiagramadeCodigo.md) |

### Arquitectura seleccionada

- **Estilo global:** arquitectura cliente-servidor de tres capas.
- **Organización del backend:** monolito modular.
- **Enfoque interno:** Clean Architecture.
- **Frontend:** Next.js y TypeScript.
- **Backend:** NestJS y TypeScript.
- **Base de datos:** PostgreSQL mediante Supabase.
- **Comunicación:** API REST sobre HTTPS.
- **Pagos:** Yape o Plin mediante códigos QR de cada puesto y validación del comerciante.

La documentación representa decisiones y propuestas de diseño arquitectónico. No implica que los componentes descritos ya estén implementados.
