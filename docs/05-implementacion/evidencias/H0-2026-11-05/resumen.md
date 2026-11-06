# Verificación del hito H0 · 2026-11-05

| Dato | Valor |
|---|---|
| Hora | 2026-11-05 20:57 |
| Commit base | 23bd5d3 (rama feat/productos-categorias); **cambios locales sin confirmar** |
| Node | v24.19.0 |
| Base de datos de las pruebas `test:db` | PostgreSQL 16 **aislada** en Docker (127.0.0.1:55440); **no** se usó Supabase |

## Comandos

| Verificación | Comando | Código de salida | Duración |
|---|---|---|---|
| Backend · prisma validate | `npm run prisma:validate` | 0 | 4 s |
| Backend · compilación | `npm run build` | 0 | 9 s |
| Backend · lint | `npm run lint` | 0 | 7 s |
| Frontend · lint | `npm run lint` | 0 | 11 s |
| Frontend · compilación | `npm run build` | 0 | 14 s |

(0 = correcto.)

## Pruebas unitarias: 184 pasan / 0 fallan / 184 total

| Archivo | Pruebas | Pasan |
|---|---|---|
| `src/app.controller.spec.ts` | 1 | 1 |
| `src/modules/auth/infrastructure/jose-verificador-token.spec.ts` | 13 | 13 |
| `src/modules/products/domain/dominio.spec.ts` | 39 | 39 |
| `src/shared/infrastructure/storage/supabase-almacen.adapter.spec.ts` | 14 | 14 |
| `src/modules/auth/application/use-cases/autenticar-solicitud.use-case.spec.ts` | 5 | 5 |
| `src/modules/catalog/application/use-cases/catalogo.use-cases.spec.ts` | 16 | 16 |
| `src/modules/merchants/application/use-cases/gestion-merchants.use-cases.spec.ts` | 13 | 13 |
| `src/modules/merchants/application/use-cases/merchants.use-cases.spec.ts` | 11 | 11 |
| `src/modules/products/application/use-cases/productos.use-cases.spec.ts` | 25 | 25 |
| `src/modules/users/application/use-cases/gestion-usuarios.use-cases.spec.ts` | 15 | 15 |
| `src/modules/users/application/use-cases/usuarios.use-cases.spec.ts` | 23 | 23 |
| `src/modules/users/infrastructure/identity/supabase-identidad.adapter.spec.ts` | 9 | 9 |

## Pruebas HTTP: 104 pasan / 0 fallan / 104 total

| Archivo | Pruebas | Pasan |
|---|---|---|
| `test/administracion.e2e-spec.ts` | 22 | 22 |
| `test/app.e2e-spec.ts` | 1 | 1 |
| `test/autenticacion.e2e-spec.ts` | 21 | 21 |
| `test/h0-administracion.e2e-spec.ts` | 18 | 18 |
| `test/matriz-autorizacion.e2e-spec.ts` | 3 | 3 |
| `test/productos.e2e-spec.ts` | 39 | 39 |

## Pruebas de base de datos (aislada): 32 pasan / 0 fallan / 32 total

| Archivo | Pruebas | Pasan |
|---|---|---|
| `test/h0-persistencia.db-spec.ts` | 4 | 4 |
| `test/modelo-restricciones.db-spec.ts` | 13 | 13 |
| `test/productos-persistencia.db-spec.ts` | 15 | 15 |
