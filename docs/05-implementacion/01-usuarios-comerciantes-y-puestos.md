# Implementación: usuarios, comerciantes y puestos

> Cubre RF01, RF03, RF05 (parcial), RF06 y RF07; HU21 y HU22. Complementa `diseño-interno-de-modulos.md`; no modifica decisiones arquitectónicas.

## Modelo (migración `20261105000000_usuarios_comerciantes_puestos`)

| Tabla | Restricciones principales |
|---|---|
| `usuarios` | `email` único y en minúsculas (CHECK); nombres/apellidos no vacíos (CHECK); `authId` único y reservado; índice por `rol`; rol y estado como enums |
| `comerciantes` | `usuarioId` único (un perfil por usuario) con FK `RESTRICT`; `nombreComercial` no vacío (CHECK) |
| `puestos` | `codigo` único en toda la plataforma; FK a `comerciantes` `RESTRICT`; índice por `comercianteId`; código y nombre no vacíos (CHECK) |

Las tres tablas tienen RLS activado sin políticas, porque Supabase expone `public` mediante PostgREST. El backend se conecta como `postgres` y no se ve afectado.

## Permisos implementados (docs/01-analisis-de-sistema/01-actores.md)

| Caso de uso | Quién puede |
|---|---|
| Registrar usuario | Sin sesión: solo rol CLIENTE (autorregistro). Administrador: cualquier rol. Otros autenticados: no |
| Consultar usuario | El propio usuario o el administrador |
| Listar usuarios / comerciantes | Administrador |
| Registrar comerciante | Administrador, sobre un usuario activo con rol COMERCIANTE y sin perfil previo |
| Consultar comerciante | Administrador o el comerciante titular |
| Registrar puesto | Administrador, para un comerciante activo |
| Listar puestos | Administrador (todos); comerciante (solo los suyos) |

La autorización vive en los casos de uso (`application/`); los controladores solo traducen HTTP.

## Incompatibilidades y decisiones pendientes

1. **Autenticación (DA03): resuelta con Supabase Auth.** Ver [02-autenticacion-supabase.md](02-autenticacion-supabase.md). Las cabeceras de desarrollo `x-dev-user-*` fueron eliminadas.
2. **Primer administrador.** La persona se registra como cliente y se promueve con `npm run usuarios:promover -- <correo> ADMINISTRADOR` (requiere acceso a la base).
3. **Roles como enum.** RF05 habla de "gestionar roles y permisos". Se modeló un rol único por usuario (enum `RolUsuario`) según RF03. Una tabla de roles/permisos o los permisos por trabajador de puesto quedan para cuando se implementen trabajadores.
4. **Fuera de alcance (no inventado):** tiendas virtuales (RF08), trabajadores de puesto, cuenta de Mercado Pago (RF52), datos fiscales del comerciante.
