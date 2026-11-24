# Configuración de Supabase (proyecto nuevo, región sa-east-1)

> Aquí solo hay **nombres y marcadores**. Los valores reales se pegan a mano en `backend/.env` y `frontend/.env.local` (ignorados por Git) y en los gestores de secretos de cada proveedor. Complementa [03 · Configuración y seguridad](03-configuracion-y-seguridad.md).

## 1. Variables

| Variable | Dónde obtenerla en Supabase | Dónde va | Pública o secreta |
|---|---|---|---|
| `DATABASE_URL` | *Connect* → **Transaction pooler** (puerto 6543) | Local (`backend/.env`), Render | **Secreta** |
| `DIRECT_URL` | *Connect* → **Session pooler** (puerto 5432) | Local (`backend/.env`); solo para migraciones. En Render solo si migra desde allí | **Secreta** |
| `SUPABASE_URL` | *Project Settings* → Data API → Project URL | Local, Render | Pública |
| `SUPABASE_ANON_KEY` | *Project Settings* → API Keys → Publishable key (`sb_publishable_…`) | Local, Render | Pública por diseño |
| `SUPABASE_SERVICE_ROLE_KEY` | *Project Settings* → API Keys → Secret key (`sb_secret_…`) | Local, Render. **Nunca** Vercel ni el navegador | **Secreta (máximo privilegio)** |
| `SUPABASE_JWT_SECRET` | *Project Settings* → JWT Keys → Legacy JWT Secret. **Dejar vacía** en este proyecto (firma asimétrica) | No se define | Secreta |
| `SUPABASE_STORAGE_BUCKET` | Nombre del bucket creado en *Storage* (`productos`) | Local, Render | Pública |
| `FRONTEND_URL` | URL del frontend (local `http://localhost:3001`; producción: la de Vercel) | Local, Render | Pública |
| `PORT` | — (Render lo inyecta) | Local | Pública |
| `DATABASE_POOL_MAX`, `ALMACEN_URL_PUBLICA`, `OPENAPI_HABILITADO` | — (opcionales) | Local, Render | Pública |
| `NEXT_PUBLIC_SUPABASE_URL` | *Project Settings* → Data API → Project URL | Local (`frontend/.env.local`), Vercel | Pública (va al navegador) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *Project Settings* → API Keys → Publishable key | Local, Vercel | Pública (va al navegador) |
| `NEXT_PUBLIC_API_URL` | URL pública del backend en Render | Local, Vercel | Pública |

### GitHub Secrets

El CI actual ([`ci.yml`](../../../.github/workflows/ci.yml)) usa una base PostgreSQL local de servicio y `SUPABASE_URL=http://localhost:54321`: **no necesita ningún secreto de Supabase**. Solo habría que crear GitHub Secrets si más adelante se añade un flujo de despliegue o de migraciones contra Supabase (`DIRECT_URL` y, si procede, los de Render/Vercel).

### Notas

- La contraseña de la base va **codificada** en las URL si tiene caracteres especiales (`/` → `%2F`, `@` → `%40`).
- `<REGION>` es el prefijo del pooler que muestra el panel (p. ej. `aws-0-sa-east-1`); cópielo tal cual.
- `prisma.config.ts` usa `DIRECT_URL` y, si falta, `DATABASE_URL`. Riesgo **controlado**: si falta `DIRECT_URL` y `DATABASE_URL` apunta al Transaction pooler (puerto 6543 o `pgbouncer=true`), los comandos que se conectan (`migrate`, `db`, `studio`) abortan con un error en español que pide definir `DIRECT_URL` con el Session pooler (5432). `generate`, `validate` y `format` no exigen la variable. La lógica está en `backend/prisma/url-migraciones.ts`, con pruebas unitarias en `url-migraciones.spec.ts`. En local y en CI (base PostgreSQL sin pooler) el comportamiento no cambia.
- Las pruebas automáticas **no** usan Supabase: usan `TEST_DATABASE_URL` (Docker local) y se abortan si apunta a una base remota.

## 2. Verificación de JWT

El backend ([`jose-verificador-token.ts`](../../../backend/src/modules/auth/infrastructure/jose-verificador-token.ts)) verifica con el JWKS de `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` (ES256, RS256 o EdDSA) **cuando `SUPABASE_JWT_SECRET` está vacía**. Solo si se define esa variable pasa a HS256. Con un proyecto nuevo, déjela vacía.

## 3. Crear el bucket `productos`

1. Panel de Supabase → **Storage** → **New bucket**.
2. Nombre: `productos` (o el valor de `SUPABASE_STORAGE_BUCKET`).
3. Marcar **Public bucket** (las imágenes se leen por URL pública).
4. Crear. No hace falta una política para subir: el backend sube con la Secret key, que omite RLS.
5. (Opcional) Limitar tipos MIME a imágenes y el tamaño máximo por archivo en las opciones del bucket.
6. Con `backend/.env` completo: `npm run build` y `npm run storage:verificar` (sube, lee y borra una imagen de prueba).

## 4. Configuración de Auth

- *Authentication* → *URL Configuration*: **Site URL** = URL del frontend; añadir a *Redirect URLs* `http://localhost:3001/**` y la URL de producción.
- *Authentication* → *Sign In / Providers*: confirmar que el correo está activo y decidir si se exige confirmación de correo.

## 5. Pendiente de autorización: aplicar migraciones

**No se ha ejecutado ninguna migración ni conexión a la base de Supabase.** Cuando se autorice, desde `backend/` y con `DIRECT_URL` (Session pooler) en `.env`:

1. Revisar `prisma/migrations/` y confirmar que la base es la del proyecto nuevo (vacía).
2. `npx prisma migrate status` (solo lectura).
3. `npx prisma migrate deploy` (aplica las migraciones existentes; no crea nuevas).
4. Comprobar las tablas en *Table Editor* y, si se necesita un administrador, `npm run build` y `npm run usuarios:promover`.

No usar `prisma migrate dev` ni `migrate reset` contra Supabase.
