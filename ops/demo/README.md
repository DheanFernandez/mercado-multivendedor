# Entorno de demostración local (spec 004, E2)

Catálogo real de Next.js con **20 productos, 8 categorías y 4 puestos de demostración** guardados en una base PostgreSQL **local** y servidos por la API NestJS real. Especificación: [`specs/004-catalogo-publico/spec.md` §8](../../specs/004-catalogo-publico/spec.md).

| Elemento | Valor |
|---|---|
| Contenedor | `mercado-dev-db` (proyecto Docker `mercado-dev`, PostgreSQL 17 Alpine), red `mercado_dev_net`, volumen `mercado_dev_pgdata` |
| Conexión | `127.0.0.1:55434`, base `mercado_dev`, credenciales locales `postgres` / `dev` |
| Separado de | `mercado-test-db` (55433, pruebas desechables), Supabase compartido y contenedores de otros proyectos |

> **Seguridad.** Todas las órdenes pasan antes por la guarda `backend/scripts/base-desarrollo.mjs`, que **aborta** si la URL no es `127.0.0.1|localhost:55434/mercado_dev` (Supabase, poolers, `mercado_test` y otros puertos se rechazan). `DATABASE_URL` de `backend/.env` (Supabase) **nunca** se usa: la URL es `DEV_DATABASE_URL` o la de por defecto. Nunca se ejecuta `migrate reset` ni `db push`.

## Preparar (una vez), desde `backend/`

```powershell
npm run db:dev:up        # crea e inicia SOLO mercado-dev-db (Docker Desktop debe estar en marcha)
npm run db:dev:ping      # solo lectura: base, usuario, puerto, versión, tablas, migraciones y recuentos
npm run db:dev:migrate   # comprueba el destino (solo lectura) y aplica «prisma migrate deploy»
npm run db:dev:seed      # idempotente: se puede repetir sin duplicar (al final asocia las fotografías que existan)
npm run build            # si backend/dist no está al día (un «nest start --watch» en marcha ya lo mantiene)
```

## Ver el catálogo

La API de demostración usa `dist/main` con `DATABASE_URL` apuntando a `mercado_dev` (el entorno del proceso tiene prioridad sobre `backend/.env`). Se inicia **sin** claves de escritura en Supabase: el Storage, el registro y las invitaciones responden 503. Sigue usando `SUPABASE_URL` de `backend/.env` solo para **verificar** las sesiones (JWKS público).

**Terminal 1 · backend** (detenga antes cualquier backend que use el mismo puerto):

```powershell
cd backend
npm run demo:api                       # API en http://localhost:3000, CORS para http://localhost:3001
```

**Terminal 2 · frontend** (detenga antes cualquier `next dev` del frontend; Next.js admite uno solo):

```powershell
cd frontend
$env:NEXT_PUBLIC_API_URL = "http://localhost:3000"   # tiene prioridad sobre frontend/.env.local
npm run dev                                          # http://localhost:3001/catalogo
```

Los puertos son fijos: API `3000` y frontend `3001` (el script `dev` del frontend fija el `3001`). Si ocupa otro puerto para la API, indíquelo con `npm run demo:api -- --puerto <puerto> --frontend http://localhost:3001` y defina `NEXT_PUBLIC_API_URL` con ese puerto; el frontend **no** debe usar el `3000`, que es el de la API.

## Carrito desde la interfaz

Los comerciantes de demostración no tienen cuenta (no pueden iniciar sesión) y no se crean cuentas de Supabase. Para usar el carrito con una cuenta de Supabase **que ya exista**, vincúlela como cliente en `mercado_dev` con su `authId` (el `sub` de su sesión; no se guarda ninguna contraseña):

```powershell
npm run db:dev:vincular -- --auth-id <uuid-de-la-cuenta> --email <correo-de-la-cuenta>
```

No use «Crear cuenta» durante la demostración: crearía la cuenta en el Supabase compartido (la API de demostración responde 503 a ese registro).

## Verificar

```powershell
npm run db:dev:verificar   # API en el puerto 3100 contra mercado_dev, con un emisor de tokens local: catálogo, búsqueda, categoría, orden, detalle, imágenes, autenticación y carrito
```

Navegador real (con la API de demostración en el puerto 3100: `npm run demo:api -- --puerto 3100 --frontend http://localhost:3210`), desde `frontend/`: `npx playwright test -c playwright.demo.config.ts`.

## Limpiar o eliminar

| Orden | Efecto |
|---|---|
| `npm run db:dev:limpiar` | Borra **solo** los datos de demostración (claves `d3e0000…`), en una transacción; aborta si un pedido los referencia |
| `npm run db:dev:stop` | Detiene el contenedor y **conserva** los datos |
| `npm run db:dev:down` | Elimina **solo** `mercado-dev-db`, su red y su volumen `mercado_dev_pgdata` |

## Fotografías locales (spec 004, E3)

Las fotografías se guardan en **`frontend/public/demo/productos/`**. Next.js las sirve en `<origen del frontend>/demo/productos/<archivo>`. La API de demostración devuelve esa URL en `imagenes[].url` porque se inicia con `ALMACEN_URL_PUBLICA` igual al origen del frontend (por defecto, el valor de `--frontend`). Nada se escribe en Supabase Storage, y `SUPABASE_URL` sigue usándose solo para verificar sesiones.

### Qué archivo va con cada producto

Formato **WebP**, como máximo **2 MB**. Nombre exacto (en minúsculas, sin tildes):

| Puesto | Producto → archivo |
|---|---|
| DEMO-A1 · Frutería La Cosecha | Palta fuerte → `palta-fuerte.webp` · Mango Kent → `mango-kent.webp` · Plátano de seda → `platano-de-seda.webp` · Limón sutil → `limon-sutil.webp` · Mandarina → `mandarina.webp` |
| DEMO-B2 · Verduras El Huerto | Tomate italiano → `tomate-italiano.webp` · Cebolla roja → `cebolla-roja.webp` · Culantro → `culantro.webp` · Papa amarilla → `papa-amarilla.webp` · Camote amarillo → `camote-amarillo.webp` |
| DEMO-C3 · Abarrotes El Granero | Lenteja bebé → `lenteja-bebe.webp` · Frejol canario → `frejol-canario.webp` · Arroz extra → `arroz-extra.webp` · Aceite vegetal → `aceite-vegetal.webp` · Huevos rosados → `huevos-rosados.webp` · Queso fresco → `queso-fresco.webp` |
| DEMO-D4 · Carnes y Pescados La Caleta | Pechuga de pollo → `pechuga-de-pollo.webp` · Carne de res para guiso → `carne-de-res-para-guiso.webp` · Bonito fresco → `bonito-fresco.webp` · Choros frescos → `choros-frescos.webp` |

Sugerencia: formato horizontal 4:3 (por ejemplo, 1200 × 900), porque la tarjeta recorta al centro. Para convertir una foto a WebP: `cwebp -q 82 foto.jpg -o palta-fuerte.webp` (herramienta libre de Google), o exportarla como WebP desde un editor de imágenes.

### Solo fotografías autorizadas

Use fotografías propias o con una licencia que permita este uso, y anote cada una:

| Archivo | Autor o fuente | Licencia o autorización | Fecha |
|---|---|---|---|
| _(vacío: aún no hay fotografías)_ | | | |

No descargue imágenes de procedencia desconocida ni use imágenes generadas como si fueran fotos reales de un comerciante.

### Incorporar o cambiar fotografías

1. Copie el archivo WebP con su nombre exacto en `frontend/public/demo/productos/`.
2. Asócielo (desde `backend/`): `npm run db:dev:fotos`. Solo escribe `producto_imagenes` de los productos de demostración en `mercado_dev`. Asocia los archivos que existen y son WebP válidos de ≤ 2 MB, y retira la asociación de los que faltan (esos productos vuelven a «Sin imagen»). La salida indica `asociadas`, `pendientes` (con el motivo) y `otrasTablasSinCambios: true`. Puede repetirlo cuantas veces quiera.
3. Recargue el catálogo. Con `next dev`, las fotos nuevas se sirven al momento; con `next start`, solo las que existían al compilar.
4. Compruebe: `npm run db:dev:verificar` (las URL de la API y la coherencia entre archivos y filas), y en el navegador `http://localhost:3001/demo/productos/palta-fuerte.webp` (origen del frontend) debe mostrar la foto. Para la prueba automática completa, consulte «Verificar».

Para quitar una foto, borre el archivo y repita el paso 2.
