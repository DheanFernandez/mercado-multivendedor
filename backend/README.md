# Backend · API del marketplace multivendedor

API REST del proyecto **Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos**. Es un **monolito modular** desarrollado con **NestJS 12** y **TypeScript** (ESM), con **Prisma 7** sobre **PostgreSQL en Supabase**. Dentro de cada módulo se aplica **Clean Architecture** ([ADR-001](../docs/01-analisis-de-sistema/decisiones/ADR-001-monolito-modular.md) y [ADR-002](../docs/01-analisis-de-sistema/decisiones/ADR-002-clean-architecture.md)).

## Contenido

1. [Requisitos](#requisitos)
2. [Instalación y ejecución](#instalación-y-ejecución)
3. [Variables de entorno](#variables-de-entorno)
4. [Organización del código](#organización-del-código)
5. [Estado de los módulos](#estado-de-los-módulos)
6. [Base de datos con Prisma](#base-de-datos-con-prisma)
7. [Autenticación y autorización](#autenticación-y-autorización)
8. [Rutas de la API](#rutas-de-la-api)
9. [Pruebas](#pruebas)
10. [Comandos disponibles](#comandos-disponibles)
11. [Consideraciones de seguridad](#consideraciones-de-seguridad)
12. [Documentación relacionada](#documentación-relacionada)

## Requisitos

- Node.js 24 (versión usada en el desarrollo) y npm.
- Un proyecto de Supabase con PostgreSQL y Auth (proveedor Email habilitado).

## Instalación y ejecución

```bash
cd backend
npm install                  # también ejecuta `prisma generate` (script postinstall)
cp .env.example .env         # en PowerShell: Copy-Item .env.example .env
# editar .env con los valores reales (ver la sección siguiente)
npx prisma migrate deploy    # aplica las migraciones a la base configurada
npm run start:dev            # API en http://localhost:3000 con recarga automática
```

Para producción: `npm run build` y luego `npm run start:prod` (ejecuta `node dist/main`).

El puerto se controla con `PORT` (3000 por defecto).

## Variables de entorno

Se definen en `backend/.env` (ignorado por Git). La plantilla versionada es [`.env.example`](.env.example), que **no debe contener credenciales reales**.

| Variable | Uso | Dónde obtenerla (Supabase) |
|---|---|---|
| `PORT` | Puerto de la API | — |
| `FRONTEND_URL` | Origen permitido por CORS y destino de los enlaces de los correos de Auth | URL del frontend (`http://localhost:3001` en local) |
| `DATABASE_URL` | Conexión en tiempo de ejecución (Prisma con `@prisma/adapter-pg`) | *Connect* → cadena del pooler |
| `DIRECT_URL` | Conexión que usa la CLI de Prisma (migraciones). Si falta, se usa `DATABASE_URL` | *Connect* → conexión directa o *Session pooler* (puerto 5432) |
| `DATABASE_POOL_MAX` | Tamaño máximo del pool (opcional, 10 por defecto) | — |
| `SUPABASE_URL` | URL del proyecto, usada para Auth y Storage | *Project Settings* → Data API |
| `SUPABASE_ANON_KEY` | Clave pública; el backend la usa para el registro | *Project Settings* → API Keys → Publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave **secreta** (solo backend). Necesaria para invitar usuarios y para subir imágenes | *Project Settings* → API Keys → Secret key |
| `SUPABASE_JWT_SECRET` | Solo si el proyecto aún usa el secreto JWT legacy (HS256). Si usa claves asimétricas, dejar vacío | *Project Settings* → JWT Keys |
| `SUPABASE_STORAGE_BUCKET` | Bucket **público** para las imágenes de productos (`productos` por defecto) | *Storage* → New bucket |
| `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` | Reservadas; **la integración con Mercado Pago aún no está implementada** | — |

Si la contraseña de la base contiene caracteres especiales, debe codificarse en la URL (por ejemplo `/` → `%2F`).

Sin `SUPABASE_SERVICE_ROLE_KEY` la API arranca, pero fallan con `503` la subida de imágenes y el alta de usuarios por el administrador. Sin `SUPABASE_URL` fallan con `503` las rutas que requieren verificar sesión.

## Organización del código

```text
backend/
├── prisma/
│   ├── schema.prisma          Modelos de datos
│   └── migrations/            Migraciones SQL versionadas
├── prisma.config.ts           Configuración de la CLI de Prisma 7
├── src/
│   ├── main.ts                Arranque y CORS
│   ├── app.module.ts          Composición de los módulos
│   ├── modules/
│   │   ├── auth/              Verificación de JWT, guard global, registro y perfil
│   │   ├── users/             Usuarios
│   │   ├── merchants/         Comerciantes y puestos
│   │   ├── products/          Categorías, productos e imágenes
│   │   ├── catalog/           Catálogo público (solo lectura)
│   │   ├── inventory/         Módulo vacío (pendiente)
│   │   ├── cart/              Módulo vacío (pendiente)
│   │   ├── orders/            Módulo vacío (pendiente)
│   │   └── payments/          Módulo vacío (pendiente)
│   ├── shared/
│   │   ├── domain/            Errores de dominio, actor y roles, objeto de valor Precio
│   │   ├── application/       Puerto de almacenamiento y paginación
│   │   ├── http/              Decoradores (@Public, @ActorRequerido) y filtro de errores
│   │   └── infrastructure/    PrismaService y adaptador de Supabase Storage
│   ├── scripts/               Utilidades de administración (promover-rol)
│   └── generated/prisma/      Cliente Prisma generado (no se versiona)
└── test/                      Pruebas HTTP y de base de datos
```

### Capas de Clean Architecture

Cada módulo de negocio se divide en capas con dependencias dirigidas hacia el dominio:

| Capa | Contenido | Puede depender de |
|---|---|---|
| `domain/` | Entidades, objetos de valor y errores con las reglas del negocio | Solo código propio (sin NestJS ni Prisma) |
| `application/` | Casos de uso y **puertos** (interfaces de repositorios y servicios) | `domain/` |
| `infrastructure/` | Adaptadores: repositorios Prisma, Supabase Auth y Storage | `application/`, `domain/`, Prisma |
| `entry-adapters/` | Controladores HTTP que traducen HTTP a casos de uso | `application/` |

Cada módulo ensambla sus piezas en su archivo `*.module.ts` (raíz de composición). Los módulos se comunican solo mediante APIs públicas: por ejemplo, `products` consulta los puestos a través de un puerto cuyo adaptador usa un caso de uso exportado por `merchants`.

La autorización por rol y por propiedad se aplica en los **casos de uso**, no en los controladores.

## Estado de los módulos

| Módulo | Estado | Alcance |
|---|---|---|
| `auth` | Implementado | Verificación de JWT de Supabase, guard global, `POST /auth/registro`, `GET /auth/me` |
| `users` | Implementado | Alta por administrador, consulta y listado |
| `merchants` | Implementado | Comerciantes y puestos |
| `products` | Implementado | Categorías, productos, estados de publicación e imágenes |
| `catalog` | Implementado | Búsqueda, filtros, paginación y detalle públicos |
| `inventory`, `cart`, `orders`, `payments` | Pendiente | Módulos vacíos; solo existe la estructura |

Aún no existen los módulos de incidencias, notificaciones, auditoría, reportes ni configuración operativa descritos en [componentes arquitectónicos](../docs/02-arquitectura-software/componentes-arquitectonicos.md).

## Base de datos con Prisma

Prisma 7 se configura en [`prisma.config.ts`](prisma.config.ts) (la URL de conexión vive allí y en `PrismaService`, no en el esquema). El cliente se genera en `src/generated/prisma` (formato ESM) y está excluido de Git.

Tablas actuales: `usuarios`, `comerciantes`, `puestos`, `categorias`, `productos` y `producto_imagenes`. Todas tienen RLS activado (sin políticas) para impedir el acceso por la API pública de Supabase; el backend se conecta con el rol `postgres`.

```bash
npm run prisma:validate        # valida el esquema
npm run prisma:generate        # genera el cliente Prisma
npx prisma migrate deploy      # aplica las migraciones pendientes (usa DIRECT_URL)
npx prisma migrate status      # consulta el estado de las migraciones
```

Migraciones existentes:

| Migración | Contenido |
|---|---|
| `20261105000000_usuarios_comerciantes_puestos` | Usuarios, comerciantes y puestos |
| `20261106000000_productos_categorias` | Categorías, productos e imágenes |

Para crear una migración nueva: modificar `schema.prisma`, generar el SQL y **revisarlo** antes de aplicarlo. En este proyecto el SQL se generó con `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, se completó a mano con las restricciones `CHECK` y las sentencias RLS, y se aplicó con `migrate deploy`. (`migrate dev` requiere permisos para crear una base sombra.) Las migraciones deben ser siempre no destructivas sobre la base compartida.

Los importes se almacenan como `NUMERIC(10,2)` y se operan en céntimos enteros; nunca se usan números de punto flotante.

## Autenticación y autorización

- **Registro, inicio de sesión y recuperación de contraseña** usan Supabase Auth. El navegador inicia y cierra sesión directamente con Supabase; el registro pasa por `POST /api/v1/auth/registro`, que crea la identidad, guarda el perfil local con rol `CLIENTE` y vincula `usuarios.authId`.
- **Cada petición protegida** envía `Authorization: Bearer <access_token>`. Un guard global verifica la firma, el emisor, la audiencia y la expiración del JWT con `jose` (JWKS de Supabase, o HS256 si se configura `SUPABASE_JWT_SECRET`).
- **El rol y el estado de la cuenta se leen siempre de PostgreSQL** (`usuarios`), nunca del token ni de datos enviados por el cliente.
- **Seguro por defecto:** toda ruta exige sesión salvo las marcadas con `@Public()`.
- Respuestas: `401` sin sesión válida, `403` sin permiso (o cuenta sin perfil o desactivada), `503` si Supabase no está configurado.

| Rol | Atribuciones implementadas |
|---|---|
| `CLIENTE` | Consultar el catálogo y su propio perfil |
| `COMERCIANTE` | Crear, editar, publicar y desactivar productos de sus propios puestos; subir imágenes; ver sus puestos |
| `ADMINISTRADOR` | Gestionar usuarios, comerciantes, puestos y categorías; ver todos los productos (solo lectura) |
| `TRABAJADOR_PUESTO` | Existe como rol, pero aún no tiene atribuciones |

**Primer administrador:** no existe una ruta para crearlo. La persona se registra como cliente y se promueve con acceso a la base:

```bash
npm run build
npm run usuarios:promover -- correo@dominio.com ADMINISTRADOR
```

Más detalle en [Autenticación con Supabase Auth](../docs/05-implementacion/02-autenticacion-supabase.md).

## Rutas de la API

Prefijo `/api/v1`. Los errores de dominio responden con `{ statusCode, codigo, mensaje }`.

### Públicas (sin sesión)

| Método y ruta | Descripción |
|---|---|
| `GET /` | Ruta de prueba de la plantilla (responde `Hello World!`) |
| `GET /api/v1/puestos/publicos` | Puestos activos de comerciantes activos (para filtrar el catálogo) |
| `POST /api/v1/auth/registro` | Autorregistro; siempre crea un `CLIENTE` |
| `GET /api/v1/categorias` | Categorías activas |
| `GET /api/v1/catalogo/productos` | Catálogo paginado. Parámetros: `q`, `categoriaId`, `puestoId`, `precioMin`, `precioMax`, `orden` (`recientes`, `precio_asc`, `precio_desc`, `nombre`), `pagina`, `limite` (máx. 50) |
| `GET /api/v1/catalogo/productos/:id` | Detalle de un producto publicado, con su categoría y su puesto |

### Con sesión

| Método y ruta | Quién puede |
|---|---|
| `GET /api/v1/auth/me` | Cualquier usuario autenticado (su perfil y rol) |
| `POST /api/v1/usuarios` | Administrador (invita al correo para definir la contraseña) |
| `GET /api/v1/usuarios` | Administrador |
| `GET /api/v1/usuarios/:id` | El propio usuario o el administrador |
| `PATCH /api/v1/usuarios/:id/rol` | Administrador (no sobre su propia cuenta) |
| `PATCH /api/v1/usuarios/:id/estado` | Administrador (activar o desactivar; no sobre su propia cuenta) |
| `POST /api/v1/comerciantes` | Administrador |
| `GET /api/v1/comerciantes` | Administrador |
| `GET /api/v1/comerciantes/:id` | Administrador o el comerciante titular |
| `PATCH /api/v1/comerciantes/:id` | Administrador (editar el nombre comercial) |
| `PATCH /api/v1/comerciantes/:id/estado` | Administrador (suspender o reactivar) |
| `POST /api/v1/puestos` | Administrador |
| `GET /api/v1/puestos` | Administrador (todos) o comerciante (los suyos) |
| `GET /api/v1/puestos/:id` | Administrador o comerciante titular |
| `PATCH /api/v1/puestos/:id` | Administrador (código, nombre, reasignar a otro comerciante activo) |
| `PATCH /api/v1/puestos/:id/estado` | Administrador (desactivar o reactivar) |
| `GET /api/v1/categorias/gestion` | Administrador (incluye inactivas) |
| `POST /api/v1/categorias` | Administrador |
| `PATCH /api/v1/categorias/:id` | Administrador |
| `PATCH /api/v1/categorias/:id/estado` | Administrador (activar o desactivar) |
| `POST /api/v1/productos` | Comerciante titular del puesto |
| `GET /api/v1/productos` | Comerciante (los suyos) o administrador (todos, lectura) |
| `GET /api/v1/productos/:id` | Comerciante titular o administrador |
| `PATCH /api/v1/productos/:id` | Comerciante titular |
| `PATCH /api/v1/productos/:id/estado` | Comerciante titular (`PUBLICAR` o `DESACTIVAR`) |
| `POST /api/v1/productos/:id/imagenes` | Comerciante titular (multipart, campo `archivo`) |
| `DELETE /api/v1/productos/:id/imagenes/:imagenId` | Comerciante titular |

Reglas relevantes: un producto aparece en el catálogo solo si está publicado y su categoría, su puesto y su comerciante están activos. Las imágenes admiten JPEG, PNG o WebP de hasta 2 MB, con un máximo de 5 por producto. Las decisiones de diseño están en [Productos, categorías y catálogo](../docs/05-implementacion/03-productos-categorias-catalogo.md).

## Pruebas

Se usa **Vitest**. Hay tres tipos de pruebas:

| Comando | Qué prueba | ¿Usa la base de datos? |
|---|---|---|
| `npm test` | Pruebas unitarias de dominio, casos de uso, verificación de JWT y adaptadores (`src/**/*.spec.ts`) | No |
| `npm run test:e2e` | Pruebas HTTP con la aplicación completa, repositorios en memoria y un verificador de tokens simulado (`test/*.e2e-spec.ts`) | No |
| `npm run test:db` | Restricciones del modelo y repositorios Prisma contra PostgreSQL (`test/*.db-spec.ts`) | **Sí** |

`npm run test:db` necesita un `.env` válido y se ejecuta contra la base configurada. Las pruebas de restricciones se revierten; las de repositorios crean datos con una etiqueta única y **los eliminan al terminar**. Úselo solo con una base de desarrollo.

Las pruebas HTTP incluyen `test/administracion.e2e-spec.ts`, que recorre la cadena administrativa (invitar comerciante, registrar perfil y puesto, publicar productos, aislamiento entre comerciantes e intentos de escalada de privilegios).

Otros comandos: `npm run test:watch` y `npm run test:cov` (cobertura).

### Prueba real de Supabase Storage

Las pruebas automáticas simulan Storage. Para verificarlo con Supabase real, complete `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y, si no usa `productos`, `SUPABASE_STORAGE_BUCKET` en `.env`; cree el bucket como **público** y ejecute:

```bash
npm run build
npm run storage:verificar
```

El script sube un PNG de prueba, comprueba su lectura pública, verifica que no se pueda sobrescribir ni subir con la clave pública (`anon`), y lo elimina. No imprime claves. Si falta alguna variable, termina con un aviso sin hacer ninguna llamada.

## Comandos disponibles

| Comando | Descripción |
|---|---|
| `npm run start:dev` | Ejecuta la API en modo desarrollo con recarga |
| `npm run start:debug` | Ejecuta con el depurador |
| `npm run build` | Compila a `dist/` |
| `npm run start:prod` | Ejecuta la versión compilada |
| `npm run lint` | Análisis estático con oxlint |
| `npm run format` | Formatea el código con Prettier |
| `npm run prisma:validate` / `npm run prisma:generate` | Valida el esquema / genera el cliente |
| `npm run usuarios:promover -- <correo> <ROL>` | Cambia el rol de un usuario (requiere `npm run build` y acceso a la base) |
| `npm run seed:medicion -- …` | Seed reproducible de datos para mediciones; **solo** acepta una base local (ver `ops/medicion/README.md`) |
| `npm run storage:verificar` | Prueba real de Supabase Storage: carga, lectura pública, eliminación y permisos (requiere `npm run build` y las claves en `.env`) |

## Consideraciones de seguridad

- No subir `.env` ni credenciales al repositorio; `backend/.gitignore` los excluye y solo se versiona `.env.example`.
- `SUPABASE_SERVICE_ROLE_KEY` es secreta: se usa solo en el backend y nunca debe llegar al navegador.
- Los permisos se deciden en el servidor a partir del rol guardado en PostgreSQL.
- Las contraseñas las gestiona Supabase Auth; el backend no las almacena. La contraseña debe tener entre 8 y 72 caracteres.
- Las imágenes se validan por su contenido real (firma del archivo), no solo por el tipo declarado.
- CORS está limitado al origen indicado en `FRONTEND_URL`.
- Pendiente: limitación de tasa propia en `/auth/registro` (hoy solo aplican los límites de Supabase) y confirmación de correo obligatoria en Supabase (recomendada).

## Documentación relacionada

- [README principal](../README.md)
- [Diseño interno de módulos](../docs/03-diseño-de-software/diseño-interno/diseño-interno-de-modulos.md)
- [Control de concurrencia en inventario (ADR-003)](../docs/01-analisis-de-sistema/decisiones/ADR-003-control-concurrencia.md)
- [Notas de implementación](../docs/05-implementacion/01-usuarios-comerciantes-y-puestos.md)
