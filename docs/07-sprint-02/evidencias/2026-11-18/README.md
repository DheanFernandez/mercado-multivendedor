# Evidencias del 18/11/2026 · Sprint 02 (implementación y validación)

| Campo | Valor |
|---|---|
| Fecha | 18/11/2026 |
| Versión evaluada | `origin/main` en **`200675c`** (merge del PR #12). Su árbol es idéntico al de `1d61dc5`, por lo que las mediciones hechas sobre la rama `test/sprint02-cobertura` valen para `main` |
| Contiene | Frontend (PR #9), Demo (#10), Swagger/OpenAPI (#11), Jest, cobertura y CI (#12) |
| Entorno | Windows 11, Node.js 24.19.0, npm 11.17.0; PostgreSQL 17.11 en un contenedor aislado (solo para la demostración funcional); sin Supabase, sin `.env` y sin migraciones fuera de esa base. Detalle en [funcional/entorno.txt](funcional/entorno.txt) |
| No incluyen | Tokens, cookies, claves ni credenciales. Los únicos datos con aspecto personal son los de la Demo (`@demo.mercado.test`, ficticios) |

> Todas las evidencias son salidas reales de las herramientas. Ninguna usa resultados ficticios. Los textos se copiaron tal como los emitió cada herramienta, salvo que se eliminaron espacios y saltos de línea sobrantes al final (para cumplir `git diff --check`); no se alteró ningún dato ni cifra. Las cifras históricas (05/11 y 16/11) **no se repitieron** y están identificadas con su fecha en el [informe final](../../04-informe-final-sprint-02.md).

## Contenido

| Carpeta o archivo | Qué demuestra |
|---|---|
| [`funcional/capturas/`](funcional/capturas/) | 8 capturas del navegador contra el frontend (`:3001`) y la API (`:3000`) reales |
| [`funcional/flujos-api.txt`](funcional/flujos-api.txt) | 24 comprobaciones de la API real y del frontend servido |
| [`funcional/carrito-real.txt`](funcional/carrito-real.txt) | 17 comprobaciones del carrito por API real y PostgreSQL, con **token firmado localmente** (no es Supabase Auth) |
| [`funcional/navegador.txt`](funcional/navegador.txt) | 9 pasos en Chromium y las llamadas de red a la API |
| [`funcional/postgresql.txt`](funcional/postgresql.txt) | Migraciones, recuentos y stock leídos de PostgreSQL |
| [`funcional/db-dev-verificar.txt`](funcional/db-dev-verificar.txt) | Verificación oficial de la Demo (`npm run db:dev:verificar`): 16 de 16 |
| [`funcional/estructura-codigo.txt`](funcional/estructura-codigo.txt) | Módulos y capas, reglas de arquitectura, páginas, pruebas y especificaciones |
| [`funcional/herramientas/`](funcional/herramientas/) | Scripts de solo lectura usados para los flujos y el navegador |
| [`pruebas/jest.txt`](pruebas/jest.txt) | Jest: 6 suites, 88 pruebas, y su cobertura **parcial** (10 archivos) |
| [`pruebas/vitest-unitarias.txt`](pruebas/vitest-unitarias.txt), [`vitest-http.txt`](pruebas/vitest-http.txt) | Vitest del backend: 338 unitarias y 132 HTTP |
| [`pruebas/cobertura-global.txt`](pruebas/cobertura-global.txt), [`cobertura-global-summary.json`](pruebas/cobertura-global-summary.json) | Cobertura global de Vitest (unitarias + HTTP) con sus cuatro métricas |
| [`pruebas/arquitectura.txt`](pruebas/arquitectura.txt), [`lint.txt`](pruebas/lint.txt), [`openapi-verificar.txt`](pruebas/openapi-verificar.txt) | Reglas de arquitectura (0 violaciones), lint y coincidencia del contrato OpenAPI |
| [`calidad/ac04/`](calidad/ac04/) | Matriz de autorización rol × ruta repetida sobre `200675c`: 252 de 252 casos conformes |
| [`ci/resumen-ci.txt`](ci/resumen-ci.txt) | Pasos y conclusión de GitHub Actions en el PR #12 y en el merge, y estado del artefacto de cobertura |

El contrato OpenAPI exportado está versionado en [`backend/openapi/openapi.json`](../../../../backend/openapi/openapi.json). Los informes HTML y LCOV de cobertura **no se incluyen** (son voluminosos y regenerables con `npm run test:cov:todo`); el CI los publica como artefacto `cobertura-backend`.

## Notas sobre las capturas

- `06-carrito-sin-sesion.png`: al abrir `/carrito` sin sesión, el frontend redirige a `/login`. Es también la captura del formulario de acceso: no se intentó iniciar sesión.
- `09-swagger-operacion.png` muestra la operación `GET /` del grupo «Sistema» desplegada (el primer grupo), no una operación del catálogo.
- `04-detalle.png` muestra «Ingresar para comprar»: sin sesión, el detalle no ofrece añadir al carrito.
- Ningún producto tiene fotografía; las tarjetas muestran «Sin imagen».

## Qué no se midió ni se descargó

- **El artefacto `cobertura-backend` existe** (840 494 bytes, expira el 02/12/2026), pero su descarga exige autenticación en GitHub (HTTP 401 sin ella): **no se inspeccionó** su contenido y no se contrastaron las cifras de Linux con las locales.
- `npm run test:db` se ejecutó **solo en CI** (pasó); no se ejecutó localmente en esta versión.
- Los escenarios EQ-03 y EQ-04 **no se repitieron** sobre `200675c`.
