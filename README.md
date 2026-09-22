# Mercado Multivendedor

Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos.

## Proyecto

Sistema web que permite a clientes realizar compras de productos pertenecientes a diferentes puestos de un mercado mediante un único pedido.

El pedido es atendido por un repartidor verificado, quien recibe el pago mediante Yape o Plin, realiza la compra en los diferentes puestos, consolida los productos y los entrega al cliente.

## Arquitectura tecnológica

- Frontend: Next.js + TypeScript
- Backend: NestJS + TypeScript
- Base de datos: PostgreSQL / Supabase
- Almacenamiento: Supabase Storage / Cloudflare R2
- Acceso público: Cloudflare
- IA: API externa para búsqueda inteligente
- Metodología: Specification-Driven Development (SDD)

## Estructura

```text
apps/
  web/        Frontend Next.js
  api/        Backend NestJS

docs/
  specs/          Especificaciones SDD
  arquitectura/   Diagramas y documentación arquitectónica
  decisiones/     ADR - Architecture Decision Records