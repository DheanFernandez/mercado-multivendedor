# Frontend · Aplicación web del marketplace

Interfaz web del proyecto **Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos**. Está desarrollada con **Next.js 16** (App Router), **React 19**, **TypeScript** y **Tailwind CSS 4**, y consume la [API REST de NestJS](../backend/README.md). La autenticación se integra con **Supabase Auth**.

> Esta versión de Next.js tiene cambios respecto a versiones anteriores (por ejemplo, `cacheComponents` está habilitado en [`next.config.ts`](next.config.ts)). Ante dudas, consulte la documentación incluida en `node_modules/next/dist/docs/` (ver [`AGENTS.md`](AGENTS.md)).

## Contenido

1. [Requisitos](#requisitos)
2. [Configuración y ejecución](#configuración-y-ejecución)
3. [Conexión con el backend](#conexión-con-el-backend)
4. [Pantallas disponibles](#pantallas-disponibles)
5. [Integración con Supabase Auth](#integración-con-supabase-auth)
6. [Estructura del frontend](#estructura-del-frontend)
7. [Comandos](#comandos)
8. [Limitaciones actuales](#limitaciones-actuales)

## Requisitos

- Node.js 24 (versión usada en el desarrollo) y npm.
- El [backend](../backend/README.md) en ejecución y un proyecto de Supabase con el proveedor Email habilitado.

## Configuración y ejecución

```bash
cd frontend
npm install
cp .env.example .env.local     # en PowerShell: Copy-Item .env.example .env.local
# completar .env.local (ver la tabla siguiente)
npm run dev -- -p 3001         # http://localhost:3001
```

`next dev` usa el puerto 3000 por defecto, que ya ocupa el backend; por eso se indica `-p 3001`. Ese puerto debe coincidir con `FRONTEND_URL` del backend (CORS).

Variables de `.env.local` (plantilla en [`.env.example`](.env.example)). Todas las variables `NEXT_PUBLIC_*` se incluyen en el código que recibe el navegador, por lo que **solo deben contener valores públicos**:

| Variable | Valor | Dónde obtenerlo (Supabase) |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto | *Project Settings* → Data API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (*Publishable key*, `sb_publishable_…`) | *Project Settings* → API Keys |
| `NEXT_PUBLIC_API_URL` | URL del backend; `http://localhost:3000` por defecto | — |

**Nunca** coloque en el frontend la clave `service_role` o *Secret key*. Los archivos `.env*` están ignorados por Git, salvo `.env.example`.

## Conexión con el backend

El frontend llama a la API de NestJS (`http://localhost:3000` en local) mediante `fetch`. Las rutas públicas (catálogo y categorías) no requieren sesión; las del panel envían `Authorization: Bearer <access_token>` con el token de la sesión de Supabase. El cliente HTTP está en [`lib/api.ts`](lib/api.ts) y los tipos en [`lib/tipos.ts`](lib/tipos.ts).

Para que funcione, el backend debe estar iniciado y con `FRONTEND_URL=http://localhost:3001` en su `.env`.

El rol del usuario lo entrega el backend (`GET /api/v1/auth/me`, leído desde PostgreSQL). La interfaz lo usa solo para decidir qué enlaces y pantallas mostrar; **la autorización real la aplica siempre el backend**.

## Pantallas disponibles

| Ruta | Descripción | Acceso |
|---|---|---|
| `/` | Portada con enlaces al catálogo y al registro | Público |
| `/catalogo` | Catálogo con búsqueda, filtro por categoría y por puesto, rango de precios, orden y paginación | Público |
| `/catalogo/[id]` | Detalle del producto: precio, unidad, categoría, puesto e imágenes | Público |
| `/registro` | Registro de cliente | Público |
| `/login` | Inicio de sesión | Público |
| `/recuperar-contrasena` | Solicitud del enlace de recuperación | Público |
| `/actualizar-contrasena` | Definir una nueva contraseña (destino del enlace de recuperación) | Enlace de recuperación |
| `/auth/callback` | Destino de los enlaces de confirmación de correo e invitación | Público |
| `/cuenta` | Perfil del usuario y cierre de sesión | Con sesión |
| `/panel/productos` | Lista de productos con filtro por estado, publicar y desactivar | Comerciante (el administrador la ve en solo lectura) |
| `/panel/productos/nuevo` | Registro de un producto | Comerciante |
| `/panel/productos/[id]` | Edición, imágenes y publicación de un producto | Comerciante (el administrador, en solo lectura) |
| `/panel` | Inicio del panel: accesos según el rol | Comerciante o administrador |
| `/panel/usuarios` | Consulta paginada de usuarios; cambiar rol y activar/desactivar cuentas | Administrador |
| `/panel/comerciantes` | Registrar el perfil de comerciantes (o invitarlos), editar su nombre y suspender/reactivar | Administrador |
| `/panel/puestos` | Registrar puestos asignados a un comerciante, editarlos, reasignarlos y desactivar/reactivar | Administrador |
| `/panel/categorias` | Crear, renombrar, activar y desactivar categorías | Administrador |

La cabecera de navegación (`components/SiteHeader.tsx`) muestra los enlaces según el rol.

## Integración con Supabase Auth

- El cliente de Supabase (`@supabase/ssr`, `@supabase/supabase-js`) se crea en el navegador en [`lib/supabase.ts`](lib/supabase.ts), con la clave pública, y de forma perezosa para que `npm run build` no requiera variables de entorno.
- **Inicio y cierre de sesión** y **recuperación de contraseña** se realizan directamente con Supabase Auth.
- **El registro** se envía al backend (`POST /api/v1/auth/registro`), que crea la identidad y el perfil local con rol `CLIENTE`. La interfaz nunca envía un rol.
- Si la sesión expira o es rechazada por el backend (`401`), la pantalla cierra la sesión y redirige a `/login`.
- Los usuarios creados por un administrador reciben una invitación por correo. Tras confirmarla, deben usar «¿Olvidó su contraseña?» para definir su contraseña.
- En *Authentication → URL Configuration → Redirect URLs* de Supabase deben estar `http://localhost:3001/auth/callback` y `http://localhost:3001/actualizar-contrasena`.

## Estructura del frontend

```text
frontend/
├── app/                        Rutas (App Router)
│   ├── layout.tsx              Diseño base y cabecera
│   ├── page.tsx                Portada
│   ├── catalogo/               Catálogo y detalle
│   ├── login/  registro/  recuperar-contrasena/  actualizar-contrasena/
│   ├── auth/callback/          Confirmación de correo
│   ├── cuenta/                 Perfil y cierre de sesión
│   └── panel/                  Productos (comerciante) y administración (usuarios, comerciantes, puestos, categorías)
├── components/
│   ├── SiteHeader.tsx          Navegación principal
│   ├── comun.tsx               Elementos de interfaz reutilizables
│   ├── auth/ui.tsx             Elementos de las pantallas de autenticación
│   ├── catalogo/               Tarjeta y detalle de producto
│   └── panel/                  Formulario, imágenes y control de acceso del panel
├── lib/
│   ├── api.ts                  Cliente HTTP del backend
│   ├── supabase.ts             Cliente de Supabase Auth
│   ├── hooks.ts                Carga de datos y control de acceso
│   ├── tipos.ts  formato.ts    Tipos y utilidades de formato
├── public/                     Archivos estáticos
└── .env.example                Plantilla de variables de entorno
```

## Comandos

| Comando | Descripción |
|---|---|
| `npm run dev -- -p 3001` | Servidor de desarrollo en `http://localhost:3001` |
| `npm run build` | Compilación de producción (incluye la comprobación de tipos) |
| `npm run start` | Sirve la compilación (`next start`; añada `-- -p 3001` para usar ese puerto) |
| `npm run lint` | Análisis con ESLint |

El frontend no incluye todavía pruebas automatizadas; se verifica con `npm run lint` y `npm run build`.

## Limitaciones actuales

- Las pantallas de administración listan hasta 100 comerciantes y usuarios para mostrar nombres y correos; con más registros haría falta paginar en el servidor.
- No existe una pantalla para cambiar el rol de un usuario existente (se hace con `npm run usuarios:promover` en el backend).
- El detalle del producto aún no permite comprar: el carrito, los pedidos y el pago están pendientes.
- No se muestra el stock disponible; depende del módulo de inventario, aún sin implementar.
- Las imágenes se muestran con `<img>` y requieren que el backend tenga configurado Supabase Storage.
- La aplicación todavía no está configurada como PWA.

## Documentación relacionada

- [README principal](../README.md) y [README del backend](../backend/README.md)
- [Contenedores del sistema (C4 nivel 2)](../docs/04-modelo-c4/Nivel2-DiagramadeContenedores.md)
- [Productos, categorías y catálogo](../docs/05-implementacion/03-productos-categorias-catalogo.md)
- [Autenticación con Supabase Auth](../docs/05-implementacion/02-autenticacion-supabase.md)
