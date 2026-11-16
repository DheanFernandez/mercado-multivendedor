# 03 · Configuración y seguridad

> **Estado: plantilla.** Aquí solo se listan los **nombres** de las variables. Ningún valor real debe escribirse en este repositorio.

## 1. Variables de entorno

Tomadas de [`backend/.env.example`](../../../backend/.env.example) y [`frontend/.env.example`](../../../frontend/.env.example).

| Variable | Componente | Sensibilidad | Uso |
|---|---|---|---|
| `PORT` | Backend | Pública | Puerto de escucha (3000 por defecto) |
| `FRONTEND_URL` | Backend | Pública | Origen permitido por CORS |
| `DATABASE_URL` | Backend | **Secreta** | Conexión de la aplicación a PostgreSQL a través del *pooler* de Supabase |
| `DIRECT_URL` | Backend | **Secreta** | Conexión directa (o *Session pooler*) que usa la CLI de Prisma para las migraciones |
| `SUPABASE_URL` | Backend | Pública | URL del proyecto de Supabase; también sirve para obtener las claves JWKS con que se verifica el JWT |
| `SUPABASE_ANON_KEY` | Backend | Pública por diseño | Registro de usuarios (*signup*) |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | **Secreta, máximo privilegio** | Invitación de usuarios y Storage; nunca debe llegar al frontend |
| `SUPABASE_JWT_SECRET` | Backend | **Secreta** | Solo si el proyecto usa el secreto JWT heredado (HS256); con claves asimétricas se deja vacía |
| `SUPABASE_STORAGE_BUCKET` | Backend | Pública | Nombre del bucket público de imágenes de productos |
| `MERCADOPAGO_ACCESS_TOKEN` | Backend | **Secreta** | Módulo de Pagos, aún sin implementar |
| `MERCADOPAGO_WEBHOOK_SECRET` | Backend | **Secreta** | Verificación de la firma del Webhook, aún sin implementar |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend | Pública (va al navegador) | Cliente de Supabase Auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | Pública (va al navegador) | Cliente de Supabase Auth |
| `NEXT_PUBLIC_API_URL` | Frontend | Pública (va al navegador) | URL de la API |

Next.js incorpora las variables `NEXT_PUBLIC_*` al código del navegador durante la compilación. Por eso deben tener sus valores de producción en el momento de `npm run build`.

## 2. Medidas de seguridad

| Medida | Estado | Referencia |
|---|---|---|
| Archivos `.env` excluidos de Git | Existe | `backend/.gitignore`, `frontend/.gitignore` |
| CORS restringido al origen de `FRONTEND_URL` | Existe | `backend/src/main.ts` |
| Verificación del JWT en el backend y roles leídos de PostgreSQL | Existe | [Autenticación](../../05-implementacion/02-autenticacion-supabase.md); matriz AC04 del Sprint 02 |
| HTTPS en el frontend y el backend | Pendiente: depende del proveedor | RC20; C4 nivel 2 §6 |
| Secretos en el gestor del proveedor, no en archivos | Pendiente | ADR-005 §7 |
| URL de redirección de Supabase Auth para el dominio de producción | Pendiente | [Demostración H0](../../05-implementacion/cumplimiento/05-h0-demostracion.md) (configuración equivalente en local) |
| Firma del Webhook de Mercado Pago | Pendiente: módulo sin implementar | ADR-005 §5.3 |
| Rotación de claves ante una filtración | Pendiente | ADR-005 §10 |
