# 02 · Infraestructura y ambientes

> **Estado: plantilla.** Los ambientes de desarrollo, pruebas e integración continua existen. El de producción no.

## 1. Ambientes

| Ambiente | Para qué sirve | Base de datos | Dónde está definido | Estado |
|---|---|---|---|---|
| Desarrollo | Trabajo diario de cada integrante | Proyecto de Supabase configurado en el `.env` local de cada integrante | [`backend/README.md`](../../../backend/README.md), [`frontend/README.md`](../../../frontend/README.md) | Existe |
| Pruebas aisladas | Pruebas de base de datos y mediciones (EQ-03, EQ-04) sin tocar Supabase | PostgreSQL 17 en Docker (`mercado_test`, solo en `127.0.0.1`) | [`ops/medicion/`](../../../ops/medicion/) | Existe |
| Integración continua | Compilar, revisar y probar cada *pull request* | PostgreSQL 17 como servicio de GitHub Actions | [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) | Existe |
| Producción | Uso público por Internet (RC20) | Por definir | Este documento | **No existe** |

## 2. Requisitos del entorno de producción

| Requisito | Valor conocido | Origen |
|---|---|---|
| Versión de Node.js | 24 (la usada en desarrollo y en CI) | [README](../../../README.md), `ci.yml` |
| Procesos | 1 proceso de backend (monolito) y 1 de frontend | ADR-001, RC11 |
| Acceso público | HTTPS para el frontend y el backend | RC20; [C4 nivel 2 §6](../../04-modelo-c4/Nivel2-DiagramadeContenedores.md#6-seguridad-entre-contenedores) |
| Conexión a la base | Conexión directa para migraciones (`DIRECT_URL`); la del *pooler* de Supabase no admite migraciones | [`backend/prisma.config.ts`](../../../backend/prisma.config.ts) |
| Capacidad mínima | Por definir | Debe permitir repetir EQ-04 (100 usuarios simultáneos) |

## 3. Por completar

- [ ] Proveedor y plan de cada componente (ver [01 · Arquitectura de despliegue](01-arquitectura-de-despliegue.md#3-decisiones-pendientes)).
- [ ] Región y latencia hacia Supabase.
- [ ] Política de respaldo de la base de datos de producción.
