# Hito H0 · cómo demostrarlo en el navegador

Hay dos demostraciones. **A** es completa pero usa tu proyecto real de Supabase (crea usuarios y datos de prueba); **B** es local y aislada, sin credenciales, y muestra el catálogo con 5 000 productos.

## A · Demostración completa (Supabase real)

**Requisitos:** `backend/.env` y `frontend/.env.local` completos (URL y clave pública de Supabase), proveedor Email habilitado y, en Supabase → Authentication → URL Configuration, las URL `http://localhost:3001/auth/callback` y `http://localhost:3001/actualizar-contrasena`.

1. **Backend** (terminal 1): `cd backend` → `npm install` → `npx prisma migrate deploy` → `npm run start:dev` (puerto 3000).
2. **Frontend** (terminal 2): `cd frontend` → `npm install` → `npm run dev -- -p 3001`.
3. **Crear tres cuentas** en `http://localhost:3001/registro` (por ejemplo `admin@…`, `comerciante@…`, `cliente@…`) y confirmar cada correo. Todas nacen como Cliente.
4. **Primer administrador** (único paso fuera del navegador; modifica tu base de desarrollo): `cd backend` → `npm run build` → `npm run usuarios:promover -- admin@tu-correo ADMINISTRADOR`.
5. **Como administrador** (`/login`):
   - `/panel/usuarios`: en la fila del comerciante cambia el rol a **Comerciante** (confirma el aviso).
   - `/panel/comerciantes`: en «Usuarios comerciantes sin perfil» elige esa cuenta, escribe el nombre comercial → **Registrar perfil**.
   - `/panel/puestos`: elige el comerciante, código `A-1` y nombre → **Registrar**. Prueba **Editar** (cambiar nombre o reasignar) y **Desactivar/Reactivar**.
   - `/panel/categorias`: crea «Frutas».
6. **Como comerciante** (ventana privada, otra sesión): `/panel/productos/nuevo` → completa el formulario (precio, por ejemplo `3.50`) → **Crear producto** → **Publicar**. *Subir imágenes requiere Storage configurado (ver bloqueos); sin la clave la pantalla mostrará «El almacenamiento de imágenes no está configurado».*
7. **Como cliente o sin sesión:** `http://localhost:3001/catalogo` → usa la búsqueda, las categorías, el rango de precios y el **filtro por puesto** → abre un producto para ver su detalle y su puesto.
8. **Protección entre comerciantes:** crea un segundo comerciante con su puesto y producto. Con su sesión, abre `/panel/productos/<id del producto del primero>`: debe mostrar un error de permiso y el producto del primero no cambia. Con la cuenta de cliente, `/panel/productos` muestra «Acceso restringido».
9. **Suspensión:** como administrador, en `/panel/comerciantes` pulsa **Suspender** → su producto desaparece de `/catalogo`; **Reactivar** → vuelve.
10. **Control de acceso:** en `/panel/usuarios` **Desactiva** a la cuenta de cliente → en su sesión, `/cuenta` muestra «Su cuenta está desactivada.» y el menú vuelve a ofrecer «Ingresar»; **Reactivar** lo restablece.

## B · Demostración local aislada del catálogo (sin Supabase)

```powershell
cd backend
npm run db:test:up; npm run db:test:migrate; npm run build
npm run seed:medicion -- --comerciantes 50 --puestos-por-comerciante 2 --productos-por-puesto 50 --categorias 20
$env:DATABASE_URL='postgresql://postgres:test@127.0.0.1:55433/mercado_test'; $env:DIRECT_URL=$env:DATABASE_URL
$env:PORT='3100'; $env:SUPABASE_URL='http://localhost:54321'; node dist/main        # deja esta terminal abierta
# otra terminal:
cd frontend; $env:NEXT_PUBLIC_API_URL='http://localhost:3100'; npm run dev -- -p 3001
```

Abre `http://localhost:3001/catalogo`: 5 000 productos con paginación, búsqueda, categorías, precio, puesto y detalle. (Las páginas de inicio de sesión no funcionan en esta variante porque no hay Supabase.) Al terminar: `npm run db:test:down` (en `backend/`).

## Qué no se puede demostrar todavía

- **Imágenes reales y la invitación de comerciantes por correo:** requieren `SUPABASE_SERVICE_ROLE_KEY` (y el bucket público `productos`) en `backend/.env`. Con ella: `npm run build` y `npm run storage:verificar`.
- Inventario, carrito, pedidos y pagos: aún no existen.
