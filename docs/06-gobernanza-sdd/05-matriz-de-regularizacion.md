# Matriz de regularización R1, R2 y R3

> **Estado: PROPUESTA.** Identifica qué especificaciones faltan para los módulos ya implementados y qué evidencia existe. **No se crearon especificaciones** ni se modificó código.
> **Honestidad de origen:** estos módulos se construyeron *antes* de adoptar Spec-Driven Development. Las especificaciones de regularización son **retroactivas**, se redactan a partir del código, las pruebas y `docs/05-implementacion/`, y así deben declararlo (`Tipo: Regularización (retroactiva)`). No sustituyen ni reescriben ningún RF, HU o ADR.

## 1. Línea base verificada

Ejecutada el 2026-11-05 antes de redactar esta matriz:

| Suite | Resultado | Base de datos |
|---|---|---|
| Pruebas unitarias (`npm test`, 10 archivos) | **155 de 155** pasan | No |
| Pruebas HTTP (`npm run test:e2e`, 4 archivos) | **83 de 83** pasan | No |
| Pruebas de base de datos (`npm run test:db`, 2 archivos, 27 bloques `it`) | **No se reejecutaron** en esta etapa; el último resultado registrado fue 28 de 28 | Sí (se evitó tocar Supabase) |

No existe la carpeta `specs/`: **ninguna** especificación, plan ni lista de tareas de Spec Kit existe todavía.

## 2. Resumen

| ID | Alcance | Requisitos (cobertura) | Evidencia | Artefactos Spec Kit | Deuda principal | Decisiones |
|---|---|---|---|---|---|---|
| **R1** · Identidad y usuarios | `auth`, `users`, `shared/http`, script `promover-rol`; páginas de acceso y `/panel/usuarios` | RF01, RF02, RF03 (completos); RF04, RF05 (parciales); HU21 (parcial); HU20 (parcial) | Alta en backend (50 pruebas unitarias y 21 HTTP, más restricciones de base de datos); sin pruebas de frontend | **Faltan todos** | 4 importaciones internas hacia `users`; permisos y trabajadores; sin auditoría; flujo real con Supabase sin prueba automática | DEC-03, DEC-05, DEC-09 |
| **R2** · Comerciantes y puestos | `merchants`; `/panel/comerciantes`, `/panel/puestos` | RF06, RF07 (parciales: alta y consulta, sin edición ni baja); HU22 (parcial); RF46 (parcial) | Media-alta (11 pruebas unitarias, parte de las 22 HTTP de administración, restricciones de base de datos) | **Faltan todos** | RF08 y RF52 sin implementar; sin suspender comerciante ni desactivar puesto; 2 importaciones internas | DEC-02, DEC-03, DEC-10 |
| **R3** · Productos, categorías y catálogo | `products`, `catalog`; catálogo, detalle y paneles de productos y categorías | RF09, RF10, RF11, RF16, RF17, RF18 (parcial en la interfaz), RF19 (parcial); HU01–HU03, HU12, HU13 | Alta (93 pruebas unitarias: 39 de dominio, 24 de casos de uso de productos, 16 de catálogo y 14 de almacenamiento; 39 HTTP; 14 bloques de persistencia); **Storage real sin verificar** | **Faltan todos** | `catalog` lee tablas ajenas; disponibilidad pendiente de Inventario; filtro por puesto sin interfaz | DEC-03 |

## 3. R1 · Identidad y usuarios

### 3.1 Evidencia existente

| Tipo | Elementos |
|---|---|
| Código backend | `modules/auth/` (módulo, guard global, controlador, verificador `jose`, caso de uso `AutenticarSolicitud`); `modules/users/` (entidad `Usuario`, `RegistrarCliente`, `RegistrarUsuario`, `ConsultarUsuario`, `ListarUsuarios`, `ObtenerResumenUsuario`, `ResolverUsuarioPorAuthId`, adaptador de Supabase Auth, repositorio Prisma); `shared/http/` (`@Public`, `@ActorRequerido`, filtro de errores); `scripts/promover-rol.ts` |
| Código frontend | `app/login`, `app/registro`, `app/recuperar-contrasena`, `app/actualizar-contrasena`, `app/auth/callback`, `app/cuenta`, `app/panel/usuarios`, `components/SiteHeader.tsx`, `components/auth/ui.tsx`, `lib/supabase.ts`, parte de `lib/api.ts` y `lib/hooks.ts` |
| Rutas | `POST /api/v1/auth/registro` (pública), `GET /api/v1/auth/me`, `POST /api/v1/usuarios`, `GET /api/v1/usuarios`, `GET /api/v1/usuarios/:id` |
| Datos | Modelo `Usuario`; migración `20261105000000_usuarios_comerciantes_puestos`; enum `RolUsuario` |
| Documentación | `docs/05-implementacion/01-usuarios-comerciantes-y-puestos.md`, `02-autenticacion-supabase.md`; README del backend (§Autenticación) |
| Pruebas unitarias | `usuarios.use-cases.spec.ts` (23), `supabase-identidad.adapter.spec.ts` (9), `jose-verificador-token.spec.ts` (13), `autenticar-solicitud.use-case.spec.ts` (5) |
| Pruebas HTTP | `autenticacion.e2e-spec.ts` (21); partes de `administracion.e2e-spec.ts` (invitación, escalada de privilegios) |
| Pruebas de base de datos | `modelo-restricciones.db-spec.ts`: correo único y en minúsculas, nombres no vacíos, `authId` único, rol y estado por defecto |

### 3.2 Criterios de aceptación derivables de las pruebas

| Criterio | Verificado por |
|---|---|
| CA-R1-01 El autorregistro crea solo `CLIENTE`, aunque se envíe otro rol | Casos de uso (`RegistrarCliente`), HTTP (autorregistro, escalada) |
| CA-R1-02 Correo normalizado y único; contraseña de 8 a 72 caracteres | Casos de uso; base de datos |
| CA-R1-03 Si falla el guardado del perfil se elimina la identidad creada | Casos de uso |
| CA-R1-04 Toda ruta es privada salvo las marcadas públicas; sin token o con token inválido → 401 | HTTP |
| CA-R1-05 El JWT se verifica (firma, emisor, audiencia, expiración, rol `authenticated`, `sub` UUID) y se rechazan `alg: none` y la confusión de algoritmo | `jose-verificador-token.spec.ts` |
| CA-R1-06 El rol se lee de PostgreSQL; cuenta sin perfil o desactivada → 403 | Caso de uso y HTTP |
| CA-R1-07 `GET /auth/me` no expone `authId` | HTTP |
| CA-R1-08 Solo el administrador invita o lista usuarios; un usuario consulta solo su perfil | Casos de uso y HTTP |
| CA-R1-09 Las cabeceras manipuladas no otorgan permisos | HTTP |
| CA-R1-10 El adaptador de Supabase usa la clave pública para registrar y la de servicio para invitar; los errores no filtran claves | `supabase-identidad.adapter.spec.ts` |

### 3.3 Huecos

| Hueco | Tipo | Referencia |
|---|---|---|
| El flujo real con Supabase (registro, confirmación, inicio de sesión, recuperación, invitación) no tiene prueba automática; solo verificación manual | Prueba | CA-R1-10; falta `SUPABASE_SERVICE_ROLE_KEY` |
| Sin pruebas automáticas del frontend | Prueba | AC09 |
| `promover-rol` sin prueba | Prueba | — |
| No hay operación para desactivar o reactivar un usuario (HU21 «controlar quiénes pueden acceder») | Requisito parcial | RF05, HU21 |
| Un solo rol por usuario sin permisos; `TRABAJADOR_PUESTO` sin atribuciones | Requisito parcial | RF05, HU20, DEC-09 |
| Sin auditoría de altas, invitaciones y promociones | Requisito | RF42, DEC-05 |
| Sin límite de intentos propio en `/auth/registro` | Calidad | AC04 |
| 4 importaciones de internos de `users` y uso de `vistaUsuario` del controlador | Deuda de arquitectura | C-06, C-07, DEC-03 |

### 3.4 Artefactos que faltan

`spec.md` · aclaraciones · `plan.md` (estructura **actual**) · `data-model.md` (`Usuario`) · `contracts/` (rutas anteriores) · `tasks.md` (**solo** los huecos y la deuda) · análisis · convergencia.

## 4. R2 · Comerciantes y puestos

### 4.1 Evidencia existente

| Tipo | Elementos |
|---|---|
| Código backend | `modules/merchants/` (entidades `Comerciante` y `Puesto`, casos de uso de registro, consulta y listado, `ObtenerPuestoParaProductos`, `ListarIdsPuestosDeTitular`, repositorios Prisma, adaptador hacia `users`) |
| Código frontend | `app/panel/comerciantes`, `app/panel/puestos`, `app/panel/page.tsx` |
| Rutas | `POST/GET /api/v1/comerciantes`, `GET /api/v1/comerciantes/:id`, `POST/GET /api/v1/puestos` |
| Datos | Modelos `Comerciante` y `Puesto`; misma migración `20261105000000_…` |
| Documentación | `docs/05-implementacion/01-usuarios-comerciantes-y-puestos.md`, `04-administracion-y-storage.md` |
| Pruebas unitarias | `merchants.use-cases.spec.ts` (11) |
| Pruebas HTTP | `administracion.e2e-spec.ts` (22: invitar, registrar comerciante, registrar puesto, consultas, aislamiento); parte de `autenticacion.e2e-spec.ts` |
| Pruebas de base de datos | `modelo-restricciones.db-spec.ts`: perfil único por usuario, claves foráneas, código de puesto único, varios puestos por comerciante, `RESTRICT`, RLS |

### 4.2 Criterios de aceptación derivables

| Criterio | Verificado por |
|---|---|
| CA-R2-01 Solo el administrador registra comerciantes y puestos | Casos de uso y HTTP |
| CA-R2-02 El comerciante debe corresponder a un usuario activo con rol `COMERCIANTE` y sin perfil previo | Casos de uso y HTTP |
| CA-R2-03 El código de puesto se normaliza y es único en la plataforma | Casos de uso, HTTP y base de datos |
| CA-R2-04 Un comerciante ve únicamente sus puestos y su perfil | Casos de uso y HTTP |
| CA-R2-05 No se puede eliminar un comerciante con puestos (`RESTRICT`); RLS activo | Base de datos |
| CA-R2-06 Un fallo al crear la identidad no deja un usuario a medias | HTTP |

### 4.3 Huecos

| Hueco | Tipo | Referencia |
|---|---|---|
| Solo alta y consulta: sin editar, suspender comerciante ni desactivar puesto (existe el campo `estado`) | Requisito parcial | RF06, RF07, HU22 «administrar» |
| Tiendas virtuales no implementadas | Requisito | RF08, HU11, DEC-10 |
| Vinculación de cuenta de Mercado Pago no implementada | Requisito | RF52, HU27, DEC-01, DEC-02 |
| Trabajadores de puesto | Requisito | HU20, DEC-09 |
| La interfaz carga 100 registros para resolver nombres; sin paginación en servidor | Calidad | AC01 |
| 2 importaciones internas hacia `users` y `products` consume `merchants` por rutas internas | Deuda | C-06, DEC-03 |
| Sin auditoría | Requisito | RF42, DEC-05 |

### 4.4 Artefactos que faltan

Los mismos que R1, con `data-model.md` de `Comerciante` y `Puesto`.

## 5. R3 · Productos, categorías y catálogo

### 5.1 Evidencia existente

| Tipo | Elementos |
|---|---|
| Código backend | `modules/products/` (entidades `Categoria` y `Producto`, casos de uso de categorías, productos e imágenes, repositorios Prisma); `modules/catalog/` (consulta y detalle públicos); `shared/domain/precio.ts`, `shared/application/paginacion.ts`, `shared/infrastructure/storage/`; `scripts/verificar-storage.ts` |
| Código frontend | `app/catalogo`, `app/catalogo/[id]`, `app/panel/productos`, `app/panel/productos/nuevo`, `app/panel/productos/[id]`, `app/panel/categorias`, `components/catalogo/`, `components/panel/`, `components/comun.tsx`, `lib/formato.ts`, `lib/tipos.ts`, parte de `lib/api.ts` |
| Rutas | `GET/POST/PATCH /api/v1/categorias[...]`, `GET /api/v1/catalogo/productos[/:id]`, `POST/GET/PATCH /api/v1/productos[...]`, `POST/DELETE …/imagenes` |
| Datos | Modelos `Categoria`, `Producto`, `ProductoImagen`; migración `20261106000000_productos_categorias` |
| Documentación | `docs/05-implementacion/03-productos-categorias-catalogo.md`, `04-administracion-y-storage.md` |
| Pruebas unitarias | `dominio.spec.ts` (39), `productos.use-cases.spec.ts` (24), `catalogo.use-cases.spec.ts` (16), `supabase-almacen.adapter.spec.ts` (14) |
| Pruebas HTTP | `productos.e2e-spec.ts` (39); parte de `administracion.e2e-spec.ts` (aislamiento entre comerciantes) |
| Pruebas de base de datos | `productos-persistencia.db-spec.ts`: restricciones del modelo, repositorios Prisma y visibilidad del catálogo |

### 5.2 Criterios de aceptación derivables

| Criterio | Verificado por |
|---|---|
| CA-R3-01 Los importes son exactos (céntimos): se rechazan cero, negativos, más de 2 decimales y flotantes | `dominio.spec.ts`, HTTP, base de datos |
| CA-R3-02 Solo el comerciante titular crea, edita, publica y desactiva productos de su puesto; cliente, administrador y otro comerciante reciben 403 | Casos de uso y HTTP |
| CA-R3-03 Un producto aparece en el catálogo solo si está publicado y su categoría, puesto y comerciante están activos | Caso de uso, HTTP y base de datos |
| CA-R3-04 El catálogo filtra por texto, categoría, puesto y precio, ordena, pagina (máximo 50) y valida los parámetros | `catalogo.use-cases.spec.ts`, HTTP, base de datos |
| CA-R3-05 Solo el administrador gestiona categorías; el nombre genera un identificador único | Casos de uso, HTTP, base de datos |
| CA-R3-06 Imágenes: JPEG/PNG/WebP, máximo 2 MB y 5 por producto, validadas por su contenido real | Casos de uso y HTTP |
| CA-R3-07 El adaptador de Storage sube sin sobrescribir, rechaza rutas peligrosas y no filtra la clave | `supabase-almacen.adapter.spec.ts` |
| CA-R3-08 El detalle público no expone datos internos | HTTP |

### 5.3 Huecos

| Hueco | Tipo | Referencia |
|---|---|---|
| `catalog` lee las tablas `producto`, `categoria`, `puesto` y `comerciante` | **Deuda de arquitectura (alta)** | C-05, DEC-03 |
| El detalle no muestra disponibilidad (depende de Inventario) | Requisito parcial | RF19, C-15 |
| La interfaz no ofrece filtro por puesto (la API sí) | Requisito parcial | RF18 |
| Storage con Supabase real sin verificar (falta la clave de servicio); `npm run storage:verificar` preparado | Prueba | CA-R3-06, CA-R3-07 |
| Rendimiento del catálogo sin medir (100 usuarios, p95 < 2 s) | Calidad | AC01, EQ-04 |
| Sin pruebas automáticas del frontend; accesibilidad sin evaluar | Prueba | AC09 |
| `catalog` no usa una API pública de `products`/`merchants`; `products` importa un caso de uso interno de `merchants` | Deuda | C-06, DEC-03 |
| Sin auditoría de cambios de productos | Requisito | RF42, DEC-05 |

### 5.4 Artefactos que faltan

Los mismos que R1; el `plan.md` debe describir la estructura **actual** y las tareas se limitan a los huecos anteriores.

## 6. Cómo redactar cada especificación de regularización

1. **Encabezado obligatorio** en `spec.md`: `Tipo: Regularización (retroactiva)`, `Origen: código, pruebas y docs/05-implementacion del 2026-11-05`, `No es un requisito nuevo`.
2. **Trazabilidad**: HU, RF, ADR, RC/AC/DA citados sin reescribirlos. Si lo implementado difiere de la documentación, se registra como *Aclaración* con su justificación.
3. **Criterios de aceptación**: los de las secciones 3.2, 4.2 y 5.2, cada uno enlazado a su prueba; lo implementado sin prueba se lista como hueco.
4. **Orden de ejecución**: `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` (estructura actual) → `/speckit-tasks` (solo huecos y deuda) → `/speckit-analyze` → `/speckit-converge` (compara el código real con la especificación).
5. **Ejemplo de instrucción** (R1):

```text
Regularización retroactiva R1 · Identidad y usuarios. Documenta lo YA implementado en los módulos auth y users
(código, pruebas y docs/05-implementacion/01 y 02). Cubre RF01–RF05, HU20 y HU21 de forma parcial según la
matriz. No introduce requisitos nuevos ni reescribe docs/. Las tareas se limitan a los huecos y la deuda listados.
```

## 7. Especificaciones aún inexistentes para el resto del proyecto

| Orden | Especificación | Estado | Bloqueada por |
|---|---|---|---|
| 1–3 | R1, R2, R3 (esta matriz) | No iniciadas | DEC-03 para las tareas de deuda |
| 4 | Infraestructura de calidad | No iniciada | DEC-07 |
| 5 | Auditoría | No iniciada | DEC-05 |
| 6 | Configuración operativa | No iniciada | — |
| 7 | Permisos, trabajadores y tiendas | No iniciada | DEC-09, DEC-10 |
| 8 | Inventario | No iniciada | Configuración; DEC-07 (fase 2) |
| 9 | Carrito | No iniciada | Inventario |
| 10 | Pedidos | No iniciada | Carrito; DEC-09 |
| 11 | Pagos fase 1 | No iniciada | **DEC-01, DEC-02** |
| 12 | Pagos fase 2 | No iniciada | **DEC-01, DEC-02** |
| 13 | Incidencias, Notificaciones, Reportes | No iniciadas | Pagos fase 2 |
| 14 | PWA | No iniciada | — |

El detalle de requisitos y dependencias está en §8 de la [revisión de consistencia](01-revision-de-consistencia.md).
