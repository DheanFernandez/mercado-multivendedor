# Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos

## Integrantes

- Fernandez Pillman Dhean Jhoner 27221302
- Gómez Prado Ederson

## Descripción

Proyecto académico orientado al diseño y desarrollo de una plataforma web multivendedor para un mercado de abastos.

La plataforma permitirá integrar comerciantes, puestos comerciales, productos, inventarios, clientes, pedidos y pagos dentro de un único sistema.

Cada comerciante podrá administrar de manera independiente la información de su puesto, productos, precios e inventario, mientras que los clientes podrán consultar y adquirir productos ofrecidos por diferentes comerciantes mediante un marketplace común.

Los clientes realizarán un pago único por pedido mediante el Checkout de Mercado Pago (entorno Sandbox), cuya confirmación la plataforma recibe automáticamente mediante un Webhook verificado, y retirarán sus productos directamente en los puestos correspondientes. La plataforma no incluye servicio de delivery.

## Objetivo

Diseñar una arquitectura de software modular, segura y escalable que permita centralizar los principales procesos comerciales y operativos de un mercado de abastos.

## Estilo arquitectónico

La solución adopta un único estilo arquitectónico: monolito modular. Toda la lógica de negocio se ejecuta en una sola aplicación desplegable (API NestJS) dividida en módulos por dominio. La aplicación Web/PWA (Next.js) es la interfaz de usuario que consume esa API mediante REST, y PostgreSQL (Supabase) es su almacén de datos. Dentro de cada módulo, el código se organiza con los principios de Clean Architecture (puertos y adaptadores); esto no es un segundo estilo.

### Monolito modular

API desarrollada con NestJS y TypeScript, desplegada como una única aplicación y organizada en módulos por dominio.

### Aplicación Web/PWA

Interfaz de usuario desarrollada con Next.js y TypeScript, que consume la API del monolito mediante REST.

### Almacenamiento

PostgreSQL mediante Supabase para la información estructurada y Supabase Storage o Cloudflare R2 para imágenes, documentos y otros archivos.

### Pasarela de pago

Pago único por pedido mediante el Checkout de Mercado Pago (entorno Sandbox), con confirmación automática mediante Webhook verificado.

## Problema que busca resolver

Los mercados de abastos suelen operar de forma fragmentada: cada puesto gestiona por separado sus precios, su stock y sus ventas, y el cliente debe recorrer el mercado puesto por puesto para comparar y comprar. La plataforma propone un **marketplace común** donde el cliente consulta productos de varios puestos y, en versiones posteriores, los compra en un solo pedido con un único pago, mientras cada comerciante conserva el control de su propio puesto.

## Actores principales

Definidos en [Actores del sistema](docs/01-analisis-de-sistema/01-actores.md):

| Actor | Rol en la plataforma |
|---|---|
| Cliente | Consulta el catálogo, y (en versiones posteriores) arma pedidos, paga y retira en los puestos |
| Comerciante | Administra sus puestos y sus productos |
| Trabajador de puesto | Apoya en la operación del puesto con permisos limitados (aún sin implementar) |
| Administrador | Administra usuarios, comerciantes, puestos y categorías |

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | NestJS 12, TypeScript (ESM) |
| ORM y base de datos | Prisma 7 y PostgreSQL (Supabase) con el adaptador `@prisma/adapter-pg` |
| Autenticación | Supabase Auth (correo y contraseña) y verificación de JWT en el backend con `jose` |
| Archivos | Supabase Storage (imágenes de productos) |
| Pruebas | Vitest y Supertest |
| Calidad | oxlint (backend) y ESLint (frontend) |
| Pasarela de pago | Mercado Pago Checkout, entorno Sandbox (**propuesta, sin implementar**) |

## Estructura del repositorio

```text
mercado-multivendedor/
├── backend/     API NestJS (monolito modular) con Prisma    → ver backend/README.md
├── frontend/    Aplicación web Next.js                      → ver frontend/README.md
├── docs/        Documentación de arquitectura e implementación
└── README.md
```

Dentro de cada módulo del backend se aplica Clean Architecture (`domain/`, `application/`, `infrastructure/`, `entry-adapters/`). El detalle está en el [README del backend](backend/README.md).

## Estado de implementación

### Implementado y verificado

- Autenticación con Supabase Auth: registro (solo rol `CLIENTE`), inicio y cierre de sesión, recuperación de contraseña, y verificación de JWT en NestJS con roles leídos desde PostgreSQL.
- Usuarios: alta por el administrador (con invitación por correo), consulta y listado.
- Comerciantes y puestos: registro y consulta mediante la API y el panel de administración.
- Panel de administración: usuarios, comerciantes, puestos y categorías.
- Categorías de productos: gestión por el administrador y listado público.
- Productos: alta, edición, publicación y desactivación por el comerciante titular del puesto; carga de imágenes (requiere configurar Supabase Storage).
- Catálogo público: búsqueda por texto, filtros por categoría, puesto y precio, orden y paginación; detalle del producto con su puesto.
- Interfaz web: catálogo, detalle, registro, inicio de sesión, recuperación de contraseña, cuenta, panel de productos del comerciante y panel de administración (usuarios, comerciantes, puestos y categorías).

### En desarrollo (estructura creada, sin lógica)

Los módulos `inventory`, `cart`, `orders` y `payments` existen en `backend/src/modules/` como módulos vacíos.

### Propuesto (solo documentado en `docs/`)

Inventario con reservas atómicas ([ADR-003](docs/01-analisis-de-sistema/decisiones/ADR-003-control-concurrencia.md)), carrito multivendedor, pedidos, pago único con Mercado Pago ([ADR-005](docs/01-analisis-de-sistema/decisiones/ADR-005-pago-unico-mercado-pago.md)), incidencias, notificaciones, auditoría, reportes, configuración operativa, tiendas virtuales, trabajadores de puesto y aplicación PWA.

## Instalación rápida

Requisitos: **Node.js 24** (versión usada en el desarrollo), npm y un proyecto de Supabase (PostgreSQL y Auth).

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env          # completar con los valores reales (ver backend/README.md)
npm run prisma:generate
npx prisma migrate deploy     # aplica las migraciones a la base configurada
npm run start:dev             # http://localhost:3000

# 2. Frontend (en otra terminal)
cd frontend
npm install
cp .env.example .env.local    # completar con los valores públicos de Supabase
npm run dev -- -p 3001        # http://localhost:3001
```

En Windows PowerShell, `cp` equivale a `Copy-Item`. Las instrucciones completas, las variables de entorno y los comandos de prueba están en [backend/README.md](backend/README.md) y [frontend/README.md](frontend/README.md).

## Curso

Arquitectura de Software - IS488

## Semestre

2026-II

## Documentación de Arquitectura de Software

El proyecto desarrolla progresivamente el análisis y diseño arquitectónico de la Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos.

```text
docs/
├── 01-analisis-de-sistema/
│   └── decisiones/            ADR-001 a ADR-005
├── 02-arquitectura-software/
├── 03-diseño-de-software/
│   └── diseño-interno/
├── 04-modelo-c4/
└── 05-implementacion/         Notas de lo implementado
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
| ADR-004: Pagos mediante QR (reemplazado por ADR-005) | [Ver documento](docs/01-analisis-de-sistema/decisiones/ADR-004-pagos-qr.md) |
| ADR-005: Pago único mediante Mercado Pago | [Ver documento](docs/01-analisis-de-sistema/decisiones/ADR-005-pago-unico-mercado-pago.md) |

### 02. Arquitectura de software

| Documento | Enlace |
|---|---|
| Arquitectura inicial y diagrama | [Ver documento](docs/02-arquitectura-software/arquitectura-inicial.md) |
| Estilo arquitectónico | [Ver documento](docs/02-arquitectura-software/estilo-arquitectonico.md) |
| Organización interna de los módulos (Clean Architecture) | [Ver documento](docs/02-arquitectura-software/enfoque-arquitectonico.md) |
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

### 05. Implementación

| Documento | Enlace |
|---|---|
| Usuarios, comerciantes y puestos | [Ver documento](docs/05-implementacion/01-usuarios-comerciantes-y-puestos.md) |
| Autenticación con Supabase Auth | [Ver documento](docs/05-implementacion/02-autenticacion-supabase.md) |
| Productos, categorías y catálogo | [Ver documento](docs/05-implementacion/03-productos-categorias-catalogo.md) |
| Administración y Storage | [Ver documento](docs/05-implementacion/04-administracion-y-storage.md) |

### Arquitectura seleccionada

- **Estilo:** monolito modular.
- **Organización interna:** Clean Architecture (puertos y adaptadores dentro de cada módulo).
- **Frontend:** Next.js y TypeScript.
- **Backend:** NestJS y TypeScript.
- **Base de datos:** PostgreSQL mediante Supabase.
- **Comunicación:** API REST sobre HTTPS.
- **Pasarela de pago:** pago único por pedido mediante el Checkout de Mercado Pago (Sandbox), con confirmación por Webhook verificado.

La documentación de las carpetas 01 a 04 representa decisiones y propuestas de diseño arquitectónico. No implica que los componentes descritos ya estén implementados: el estado real se resume en [Estado de implementación](#estado-de-implementación) y en la carpeta `05-implementacion`.
