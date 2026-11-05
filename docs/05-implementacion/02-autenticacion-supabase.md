# Autenticación con Supabase Auth

> Resuelve el TODO de DA03 en `Nivel2-DiagramadeContenedores.md` (Supabase Auth o JWT propio): se usa **Supabase Auth**. Cubre RF01–RF03 y RF05 (parcial).

## Flujo

| Acción | Dónde ocurre |
|---|---|
| Registro | Next.js → `POST /api/v1/auth/registro` → el backend crea la identidad en Supabase (clave pública), guarda `usuarios` con rol **CLIENTE** y vincula `authId` |
| Inicio / cierre de sesión | Next.js ↔ Supabase Auth directamente (`signInWithPassword`, `signOut`) |
| Recuperación de contraseña | Next.js → `resetPasswordForEmail` → enlace a `/actualizar-contrasena` → `updateUser` |
| Peticiones a la API | `Authorization: Bearer <access_token>`; el backend verifica firma, emisor, audiencia y expiración del JWT (librería `jose`, JWKS de Supabase) |
| Rol y permisos | Siempre desde `public.usuarios` (PostgreSQL), por `authId = sub`. Nada del token ni del frontend define permisos |
| Alta por administrador | `POST /api/v1/usuarios` → invitación de Supabase (clave de servicio, solo backend) y `authId` guardado |

Guard global (`AuthGuard`): toda ruta es privada salvo las marcadas con `@Public()` (raíz y `/auth/registro`). Cuenta sin perfil vinculado o desactivada → 403; token ausente o inválido → 401; Supabase no configurado → 503.

## Decisiones y límites

- **Contraseña:** entre 8 y 72 caracteres (regla del proyecto, no de la documentación previa). Nunca se almacena en la base local.
- **Sin autenticación por cabeceras de desarrollo:** `x-dev-user-id`/`x-dev-user-role` se eliminaron; hay una prueba que verifica que ya no autentican.
- **Usuarios invitados por un administrador:** el enlace de invitación confirma la cuenta y llega a `/auth/callback`; para definir contraseña usan «¿Olvidó su contraseña?». Las URL `FRONTEND_URL/auth/callback` y `<frontend>/actualizar-contrasena` deben estar en *Authentication > URL Configuration > Redirect URLs* de Supabase.
- **Cuenta huérfana:** si Supabase crea la identidad y falla el guardado local, se intenta eliminar la identidad (necesita la clave de servicio). Una identidad sin perfil recibe 403.
- **Pendiente recomendado:** limitación de tasa (rate limiting) propia en `/auth/registro` (hoy solo aplican los límites de Supabase) y confirmación obligatoria de correo en Supabase.
- **Primer administrador:** `npm run build && npm run usuarios:promover -- correo ADMINISTRADOR` tras registrarse como cliente.
