# Propuesta de contratos públicos entre módulos

> **Estado: PROPUESTA (DEC-03, `PENDIENTE`).** Describe el estado objetivo; **no se ha implementado ni modificado código**. Los bloques de código son ilustrativos.
> **Alcance:** `auth`, `users`, `merchants`, `products` y `catalog`. Sin microservicios; el monolito modular y Clean Architecture no cambian.
> **Normativa de origen:** ADR-001 §5 y §8; ADR-002 §6; C4 nivel 3 §6 (reglas 2 y 3); diseño interno de módulos (`index.ts`, patrón Facade).

## 1. Objetivo y reglas

1. Un módulo solo usa a otro a través de su **API pública** (`index.ts`), nunca de archivos internos (C4 N3, regla 2).
2. Un módulo **solo lee y escribe sus propias tablas** (regla 3).
3. El consumidor define un **puerto** en su capa `application/`; un **adaptador** de su `infrastructure/` lo implementa llamando únicamente al `index.ts` del proveedor (C4 N4: `InventarioAdapter`).
4. Las dependencias no forman ciclos (regla 4).
5. `domain/` y `application/` no importan NestJS, Prisma, Supabase ni otro módulo.

## 2. Estado actual (verificado en el código)

### 2.1 Importaciones de archivos internos ajenos (6)

| Origen | Importa | Capa tocada |
|---|---|---|
| `auth/infrastructure/usuario-por-auth-id.adapter.ts` | `users/application/use-cases/resolver-usuario-por-auth-id` | aplicación |
| `auth/entry-adapters/auth.controller.ts` | `users/application/use-cases/consultar-usuario` | aplicación |
| `auth/entry-adapters/auth.controller.ts` | `users/application/use-cases/registrar-cliente` | aplicación |
| `auth/entry-adapters/auth.controller.ts` | `users/entry-adapters/controllers/usuarios.controller` (`vistaUsuario`) | **presentación** |
| `merchants/infrastructure/adapters/usuario-consulta.adapter.ts` | `users/application/use-cases/obtener-resumen-usuario` | aplicación |
| `products/infrastructure/puesto-consulta.adapter.ts` | `merchants/application/use-cases/puestos.use-cases` | aplicación |

Las importaciones de `*.module.ts` (p. ej. `auth.module` → `users.module`) son la forma normal de componer módulos de Nest y se mantienen.

### 2.2 Lectura de tablas ajenas

`catalog/infrastructure/prisma-catalogo.repository.ts` consulta `producto` junto con sus relaciones `categoria`, `puesto` y `comerciante`, que pertenecen a `products` y `merchants`.

### 2.3 Contratos públicos existentes

Ningún módulo tiene `index.ts`. `users.module` exporta cuatro casos de uso y `merchants.module` exporta dos, pero los consumidores los importan por su ruta interna.

## 3. Mapa de dependencias permitidas

```text
                    ┌──────────┐
   guard global ───►│   auth   │──► users
                    └──────────┘
catalog ──► products ──► merchants ──► users
   │                        ▲
   └────────────────────────┘
(futuro) catalog ──► inventory
```

| Consumidor | Puede depender de | Mediante |
|---|---|---|
| `auth` | `users` | `UsuariosApi` |
| `merchants` | `users` | `UsuariosApi` |
| `products` | `merchants` | `PuestosApi` |
| `catalog` | `products`, `merchants` (y `inventory` cuando exista) | `ProductosPublicadosApi`, `PuestosApi` |
| `users` | ningún módulo de negocio | — |

Ningún módulo importa `auth`: el guard es global y los controladores solo usan `@Public()` y `@ActorRequerido()` de `shared/http`.

## 4. Contratos propuestos por módulo

### 4.1 `users` → `UsuariosApi`

| Método | Entrada → salida | Lo usa | Reemplaza |
|---|---|---|---|
| `resolverPorAuthId` | `authId` → `UsuarioAutenticado \| null` (`id`, `rol`, `activo`) | `auth` | `ResolverUsuarioPorAuthId` interno |
| `obtenerResumen` | `id` → `ResumenUsuario \| null` (`id`, `rol`, `activo`) | `merchants` | `ObtenerResumenUsuario` interno |
| `registrarCliente` | `{ email, contrasena, nombres, apellidos, telefono? }` → `PerfilUsuarioDto` | `auth` | `RegistrarCliente` interno |
| `obtenerPerfil` | `(id, actor)` → `PerfilUsuarioDto` | `auth` (`GET /auth/me`) | `ConsultarUsuario` + `vistaUsuario` |

```ts
// users/index.ts (propuesto)
export { UsersModule } from './users.module.js';
export { UsuariosApi } from './public-api/usuarios.api.js';
export type { PerfilUsuarioDto, UsuarioAutenticado, ResumenUsuario } from './public-api/dtos.js';

// PerfilUsuarioDto: id, email, nombres, apellidos, telefono, rol, estado, creadoEn  (nunca authId)
```

Invariantes: el `authId` no sale del módulo; la API devuelve DTO, no entidades; los errores de dominio (`ErrorProhibido`, etc.) son los de `shared/domain`.

### 4.2 `auth`

`auth` es un módulo hoja: **no expone API a otros módulos**. Su contrato es transversal y ya vive en `shared/http` (`@Public()`, `@ActorRequerido()`, `PeticionConActor`). Internamente consume `UsuariosApi` mediante sus propios puertos `UsuarioPorAuthIdPort` y un nuevo `PerfilPort`/`RegistroClientePort`.

Alternativa de DEC-03 (c): fusionar `auth` y `users` en un único módulo «Autenticación y usuarios» como figura en la documentación; se descarta en la recomendación para no mezclar la verificación de tokens con la gestión de usuarios.

### 4.3 `merchants` → `PuestosApi`

| Método | Entrada → salida | Lo usa | Reemplaza |
|---|---|---|---|
| `obtenerPuesto` | `puestoId` → `PuestoResumen \| null` | `products` | `ObtenerPuestoParaProductos` interno |
| `idsDePuestosDeTitular` | `usuarioId` → `string[]` | `products` | `ListarIdsPuestosDeTitular` interno |
| `listarPuestosOperativos` *(nuevo)* | — → `PuestoPublico[]` | `catalog` | lectura de tablas por `catalog` |

```ts
// merchants/index.ts (propuesto)
export { MerchantsModule } from './merchants.module.js';
export { PuestosApi } from './public-api/puestos.api.js';
export type { PuestoResumen, PuestoPublico } from './public-api/dtos.js';

// PuestoResumen:  id, codigo, nombre, operativo, usuarioIdTitular     (autorización por propiedad)
// PuestoPublico:  id, codigo, nombre                                   (solo datos públicos)
```

Futuro (sujeto a DEC-02): `estaVinculado(puestoId)` y, con modalidad `split`, `obtenerCuentaPago(puestoId)` para `payments`.

### 4.4 `products` → `ProductosPublicadosApi`

| Método | Entrada → salida | Lo usa |
|---|---|---|
| `buscarPublicados` | `(filtro, puestoIdsOperativos)` → `{ items: ProductoPublicadoDto[]; total }` | `catalog` |
| `obtenerPublicado` | `(id, puestoIdsOperativos)` → `ProductoPublicadoDto \| null` | `catalog` |

```ts
// ProductoPublicadoDto (sin datos del puesto: el catálogo los compone)
interface ProductoPublicadoDto {
  id: string; puestoId: string; nombre: string; descripcion: string | null;
  precio: string;                       // "12.50", nunca number
  unidadVenta: string; presentacion: string | null;
  categoria: { id: string; nombre: string; slug: string };
  imagenes: { ruta: string; textoAlternativo: string | null; orden: number }[];
}
```

Regla de visibilidad que `products` aplica con **sus propias tablas**: `estado = PUBLICADO`, categoría activa y `puestoId` incluido en `puestoIdsOperativos` (la parte «puesto y comerciante activos» la decide `merchants`). Futuro: `obtenerParaCompra(id)` (precio vigente) para `cart` y `orders`.

### 4.5 `catalog`

No expone API a otros módulos: es una **capa de composición** de solo lectura.

```text
ConsultarCatalogo
  1. PuestosPublicosPort.listarOperativos()                 → merchants (PuestosApi)
  2. ProductosPublicadosPort.buscar(filtro, idsOperativos)  → products (ProductosPublicadosApi)
  3. Componer: producto + datos públicos del puesto (por puestoId) + URL de imágenes (shared/storage)
  4. (futuro) DisponibilidadPort.consultar(ids)             → inventory
```

El filtro `puestoId` solo es válido si el puesto está operativo. La interfaz HTTP (`GET /api/v1/catalogo/productos…`) no cambia.

Escala: con las decenas o cientos de puestos de un mercado, pasar los ids operativos como filtro es suficiente. Si el volumen lo exigiera, DEC-03(b)(ii) (proyección propia alimentada por eventos del Outbox) sería una decisión posterior con su propio ADR.

## 5. Patrón de implementación (para el consumidor)

```ts
// merchants/application/ports/ports.ts  — puerto definido por el CONSUMIDOR (ya existe: UsuarioConsultaPort)
export interface UsuarioConsultaPort {
  obtenerResumen(id: string): Promise<{ id: string; rol: Rol; activo: boolean } | null>;
}

// merchants/infrastructure/adapters/usuario-consulta.adapter.ts  — importa SOLO el index del proveedor
import { UsuariosApi } from '../../../users/index.js';

@Injectable()
export class UsuarioConsultaAdapter implements UsuarioConsultaPort {
  constructor(@Inject(UsuariosApi) private readonly usuarios: UsuariosApi) {}
  obtenerResumen(id: string) { return this.usuarios.obtenerResumen(id); }
}
```

`UsersModule` exporta `UsuariosApi` (clase fachada que delega en los casos de uso internos). La composición sigue en el `*.module.ts` de cada módulo.

## 6. Qué puede estar en `shared/`

Permitido (transversal y sin reglas de un dominio concreto): errores de dominio, `Actor`/`Rol`, `Precio`/`Monto`, paginación, `PrismaService`, puerto y adaptador de almacenamiento, `shared/http`. **No** debe contener casos de uso ni reglas de un módulo.

## 7. Reglas verificables (propuesta para DEC-07)

Con `dependency-cruiser` (ya nombrado en EQ-07), a instalar solo si se aprueba:

```js
// .dependency-cruiser.cjs (bosquejo; validar con la herramienta al instalarla)
forbidden: [
  { name: 'solo-index-entre-modulos', severity: 'error',
    from: { path: '^backend/src/modules/([^/]+)/' },
    to:   { path: '^backend/src/modules/[^/]+/(?!index\\.ts$)', pathNot: '^backend/src/modules/$1/' } },
  { name: 'sin-framework-en-el-nucleo', severity: 'error',
    from: { path: '^backend/src/modules/[^/]+/(domain|application)/' },
    to:   { path: '(node_modules/(@nestjs|@prisma|pg|jose)|src/generated/prisma)' } },
  { name: 'sin-ciclos', severity: 'error', from: {}, to: { circular: true } },
]
```

Además, una prueba de arquitectura sencilla (o revisión) que compruebe que cada módulo usa solo los modelos Prisma que le pertenecen.

| Módulo | Modelos Prisma propios |
|---|---|
| `users` | `Usuario` |
| `merchants` | `Comerciante`, `Puesto` |
| `products` | `Categoria`, `Producto`, `ProductoImagen` |
| `catalog` | ninguno |

## 8. Plan de migración (se ejecutará dentro de las especificaciones de regularización)

| Paso | Cambio | Especificación | Riesgo |
|---|---|---|---|
| 1 | Crear `UsuariosApi` y `index.ts` de `users`; `auth` y `merchants` pasan a usarlo; `vistaUsuario` sale del controlador | R1 y R2 | Bajo (cobertura: 23 + 9 + 13 + 5 pruebas unitarias y 21 HTTP) |
| 2 | Crear `PuestosApi` con `listarPuestosOperativos`; `products` lo usa | R2 y R3 | Bajo |
| 3 | Crear `ProductosPublicadosApi` en `products` | R3 | Medio |
| 4 | Reescribir `catalog` como composición, sin Prisma | R3 | Medio: reproducir filtros, orden y paginación; las 16 pruebas del caso de uso y las 39 pruebas HTTP de productos y catálogo son la red de seguridad |
| 5 | Activar `dependency-cruiser` (DEC-07 fase 1) | Calidad | Bajo |

Ningún paso cambia rutas HTTP, esquema Prisma ni datos.

## 9. Contratos futuros previstos (C4 nivel 3 §4)

`inventory` expone `ReservarInventarioUseCase` y consulta de disponibilidad (C4 N4); `cart` consume `ProductosPublicadosApi` y disponibilidad; `orders` consume `cart`, `inventory`, `payments` y `Configuración`; `payments` consume `PuestosApi` y publica el evento `PagoAprobado` por Outbox; `Auditoría` expone `AuditoriaPort` a Pagos, Pedidos e Inventario.

## 10. Decisión requerida

DEC-03 (a, b y c) en el [registro de decisiones](02-registro-de-decisiones.md). Mientras no se apruebe, la constitución prohíbe **nuevas** violaciones pero no obliga a corregir las existentes.
