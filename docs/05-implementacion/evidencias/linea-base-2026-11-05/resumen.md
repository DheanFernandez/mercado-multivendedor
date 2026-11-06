# Línea base de verificación · 2026-11-05

> Evidencia generada automáticamente al preparar la matriz de cumplimiento. **No incluye** pruebas de base de datos, carga, concurrencia ni mediciones EQ (ninguna se ha ejecutado).

| Dato | Valor |
|---|---|
| Fecha | 2026-11-05 20:25 |
| Commit base | 23bd5d3 (rama feat/productos-categorias); **hay cambios locales sin confirmar** |
| Node / npm | v24.19.0 / 11.17.0 |
| Sistema | Microsoft Windows NT 10.0.26100.0, 4 CPU lógicas |

## Comandos

| Verificación | Comando | Código de salida | Duración |
|---|---|---|---|
| Backend · prisma validate | `npm run prisma:validate` | 0 | 15s |
| Backend · compilación | `npm run build` | 0 | 17s |
| Backend · lint | `npm run lint` | 0 | 8s |
| Frontend · lint | `npm run lint` | 0 | 46s |
| Frontend · compilación | `npm run build` | 0 | 61s |

(Código de salida 0 = correcto.)

## Pruebas unitarias · `npm test`: 155 pasan / 0 fallan / 155 total

| Archivo | Pruebas | Pasan |
|---|---|---|
| `src/app.controller.spec.ts` | 1 | 1 |
| `src/modules/auth/infrastructure/jose-verificador-token.spec.ts` | 13 | 13 |
| `src/modules/products/domain/dominio.spec.ts` | 39 | 39 |
| `src/shared/infrastructure/storage/supabase-almacen.adapter.spec.ts` | 14 | 14 |
| `src/modules/auth/application/use-cases/autenticar-solicitud.use-case.spec.ts` | 5 | 5 |
| `src/modules/merchants/application/use-cases/merchants.use-cases.spec.ts` | 11 | 11 |
| `src/modules/catalog/application/use-cases/catalogo.use-cases.spec.ts` | 16 | 16 |
| `src/modules/products/application/use-cases/productos.use-cases.spec.ts` | 24 | 24 |
| `src/modules/users/application/use-cases/usuarios.use-cases.spec.ts` | 23 | 23 |
| `src/modules/users/infrastructure/identity/supabase-identidad.adapter.spec.ts` | 9 | 9 |

## Pruebas HTTP · `npm run test:e2e`: 83 pasan / 0 fallan / 83 total

| Archivo | Pruebas | Pasan |
|---|---|---|
| `test/administracion.e2e-spec.ts` | 22 | 22 |
| `test/app.e2e-spec.ts` | 1 | 1 |
| `test/autenticacion.e2e-spec.ts` | 21 | 21 |
| `test/productos.e2e-spec.ts` | 39 | 39 |

Los resultados completos (por prueba) están en `unitarias.json` y `http.json` de esta carpeta.
