# Panel de administración y verificación de Storage

> Cubre HU21 y HU22 (administrar usuarios, comerciantes y puestos) desde la interfaz web. No se agregaron endpoints ni casos de uso: el panel usa la API existente.

## Rutas utilizadas por el panel

| Pantalla | Rutas de la API | Autorización en el backend |
|---|---|---|
| `/panel/usuarios` | `GET /api/v1/usuarios` | Administrador (caso de uso `ListarUsuarios`) |
| `/panel/comerciantes` | `POST /api/v1/usuarios` (invitar, rol `COMERCIANTE`), `POST /api/v1/comerciantes`, `GET /api/v1/comerciantes`, `GET /api/v1/usuarios` | Administrador |
| `/panel/puestos` | `POST /api/v1/puestos`, `GET /api/v1/puestos?comercianteId=`, `GET /api/v1/comerciantes` | Administrador |
| `/panel/categorias` | `GET /categorias/gestion`, `POST`, `PATCH /:id`, `PATCH /:id/estado` | Administrador |

La interfaz oculta lo que el rol no puede usar, pero **cada operación se autoriza de nuevo en NestJS**, a partir del rol guardado en PostgreSQL. El rol nunca se toma del token ni de datos del navegador, y no existe ninguna ruta para que un usuario cambie su propio rol.

## Flujo para dar de alta un comerciante y su puesto

1. El administrador abre **Comerciantes** e invita al comerciante (correo, nombres, apellidos, nombre comercial). El sistema crea el usuario con rol `COMERCIANTE`, envía la invitación por Supabase y registra su perfil comercial.
2. En **Puestos**, el administrador registra el puesto (código único, por ejemplo `A-12`) y lo asigna al comerciante.
3. El comerciante define su contraseña con «¿Olvidó su contraseña?», inicia sesión y administra los productos de su puesto desde **Mis productos**.

Si el paso de invitar falla a mitad (usuario creado pero sin perfil), el usuario aparece en «Usuarios comerciantes sin perfil» para completar el registro.

**Requisito:** la invitación necesita `SUPABASE_SERVICE_ROLE_KEY` en el backend. Sin ella el alta responde `503`. Alternativa para pruebas sin esa clave: registrar la cuenta como cliente y promoverla con `npm run usuarios:promover -- correo COMERCIANTE`; luego se registra su perfil desde «Usuarios comerciantes sin perfil».

## Supabase Storage

Revisión del adaptador (`backend/src/shared/infrastructure/storage/supabase-almacen.adapter.ts`):

| Aspecto | Estado |
|---|---|
| Bucket | `SUPABASE_STORAGE_BUCKET` (por defecto `productos`); debe existir y ser **público** de lectura |
| Escritura | Solo desde el backend con `SUPABASE_SERVICE_ROLE_KEY`; sin sobrescritura (`x-upsert: false`) |
| Formatos | JPEG, PNG y WebP; se comprueba la firma real del archivo, no solo el tipo declarado |
| Tamaño | Máximo 2 MB por imagen (límite en el interceptor de carga y en el caso de uso) y 5 imágenes por producto |
| Rutas | Generadas por el servidor (`<productoId>/<uuid>.<ext>`); el adaptador rechaza cualquier ruta con `..`, `//`, `/` inicial o caracteres fuera de `[A-Za-z0-9._/-]` |
| Secretos | La clave nunca se registra en logs, no aparece en mensajes de error ni en las URL públicas, y no llega al navegador |
| Sin configuración | Subir imágenes responde `503`; el resto de la API no se afecta |

Las pruebas automáticas (`supabase-almacen.adapter.spec.ts`) verifican estos puntos con un cliente HTTP simulado. La **prueba real** se ejecuta con `npm run storage:verificar` (ver el [README del backend](../../backend/README.md)) cuando estén disponibles las claves: carga, lectura pública, no sobrescritura, rechazo de escritura con la clave pública y eliminación.

Recomendación para el bucket en Supabase: marcarlo como público y **sin** políticas de `INSERT`, `UPDATE` ni `DELETE` para `anon` ni `authenticated` (toda escritura pasa por el backend).

## Limitaciones conocidas

- Las pantallas de administración cargan hasta 100 comerciantes y usuarios para resolver nombres; con volúmenes mayores habrá que paginar o enriquecer la respuesta en el servidor.
- No hay pantalla para cambiar el rol, suspender un comerciante o desactivar un puesto (la API actual no expone esas operaciones).
