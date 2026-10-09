# Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos

## Integrantes

- Fernandez Pillman Dhean Jhoner
- Gómez Prado Ederson

## Descripción

Proyecto académico orientado al diseño y desarrollo de una plataforma web multivendedor para un mercado de abastos.

La plataforma permitirá integrar comerciantes, puestos comerciales, productos, inventarios, clientes, pedidos, repartidores y procesos de entrega dentro de un único sistema.

Cada comerciante podrá administrar de manera independiente la información de su puesto, productos, precios e inventario, mientras que los clientes podrán consultar y adquirir productos ofrecidos por diferentes comerciantes mediante un marketplace común.

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

### Guía 02: Análisis y arquitectura inicial

| Documento | Enlace |
|---|---|
| Actores del sistema | [Ver documento](analisis-del-sistema/01-actores.md) |
| Historias de usuario | [Ver documento](analisis-del-sistema/02-historias-de-usuario.md) |
| Requisitos funcionales | [Ver documento](analisis-del-sistema/03-requisitos-funcionales.md) |
| Atributos de calidad | [Ver documento](analisis-del-sistema/04-atributos-de-calidad.md) |
| Restricciones arquitectónicas | [Ver documento](analisis-del-sistema/05-restricciones.md) |
| Drivers arquitectónicos | [Ver documento](analisis-del-sistema/06-drivers-arquitectonicos.md) |
| Arquitectura inicial y diagrama | [Ver documento](arquitectura/arquitectura-inicial.md) |

### Guía 03: Estilos y enfoques arquitectónicos

| Documento | Enlace |
|---|---|
| ADR-001: Monolito modular | [Ver documento](arquitectura/decisiones/ADR-001-monolito-modular.md) |
| ADR-002: Clean Architecture | [Ver documento](arquitectura/decisiones/ADR-002-clean-architecture.md) |
| ADR-003: Control de concurrencia | [Ver documento](arquitectura/decisiones/ADR-003-control-concurrencia.md) |
| ADR-004: Pagos mediante QR | [Ver documento](arquitectura/decisiones/ADR-004-pagos-qr.md) |
| Estilo arquitectónico | [Ver documento](arquitectura/estilo-arquitectonico.md) |
| Enfoque Clean Architecture | [Ver documento](arquitectura/enfoque/enfoque-arquitectonico.md) |

### Arquitectura seleccionada

- **Estilo global:** arquitectura cliente-servidor de tres capas.
- **Organización del backend:** monolito modular.
- **Enfoque interno:** Clean Architecture.
- **Frontend:** Next.js y TypeScript.
- **Backend:** NestJS y TypeScript.
- **Base de datos:** PostgreSQL mediante Supabase.
- **Comunicación:** API REST sobre HTTPS.
- **Pagos:** Yape o Plin mediante códigos QR y validación del repartidor.

La documentación representa decisiones y propuestas de diseño arquitectónico. No implica que los componentes descritos ya estén implementados.
