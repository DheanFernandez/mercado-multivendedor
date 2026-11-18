# Especificación: Pruebas con Jest y cobertura reproducible (Sprint 02 · IS-488)

Derivada de la auditoría del 2026-11-18 sobre `59826e7` y de las decisiones del responsable: **mantener Vitest como ejecutor principal**, incorporar una **suite representativa con Jest** y medir una **cobertura global reproducible**. No cambia reglas de negocio, contratos, módulos ni arquitectura.

## 1. Origen y alcance

- **Origen:** entregable 4 del Sprint 02 («pruebas automatizadas con Jest y reporte de cobertura»). La auditoría comprobó que el backend usa Vitest, que no hay Jest, que `test:cov` sin configuración daba 94,14 % porque solo medía los archivos que las pruebas importan, y que el CI no mide cobertura ni ejecuta el Vitest del frontend.
- **Tipo:** herramientas de calidad (configuración, pruebas y CI). **Ningún archivo bajo `backend/src/modules/**` cambia.**
- **Trazabilidad:** constitución IX (pruebas unitarias sin red ni base de datos; resultados reales) y X; RC10 y EQ-07 (verificaciones en cada pull request); AC05 (mantenibilidad); HU04–HU06 y RF20–RF24 (carrito), RF12–RF15 (inventario), RF16–RF19 (catálogo) como reglas ejercitadas por la suite Jest.

| Dentro | Fuera (declarado) |
|---|---|
| Jest 30 como ejecutor **adicional** (`npm run test:jest`) con una suite representativa de dominio y casos de uso (carrito, inventario, catálogo) | Migrar las suites de Vitest a Jest; sustituir Vitest |
| Informe de cobertura **propio de Jest**, separado y rotulado como parcial | Presentar la cobertura de Jest como cobertura del backend |
| Definición **única** de cobertura de Vitest sobre `backend/src/**` y combinación de pruebas unitarias y HTTP | Cobertura de `test:db` (PostgreSQL) y de Playwright |
| Umbrales conservadores en la ejecución combinada | Umbrales por archivo o por capa; subirlos para «mejorar» la cifra |
| CI: Jest, cobertura combinada con artefacto descargable y Vitest del frontend | Playwright en CI; cobertura del frontend; despliegue (Sprint 03) |

## 2. Decisiones

| ID | Decisión | Justificación |
|---|---|---|
| D1 | **Vitest sigue siendo el ejecutor principal**; Jest es adicional | Decisión del responsable. Las ~470 pruebas de Vitest usan ESM, `vi` y alias; migrarlas es de alto riesgo sin beneficio medible |
| D2 | **ts-jest 29 con ESM nativo** (`--experimental-vm-modules`, `extensionsToTreatAsEsm` para `.ts`, `moduleNameMapper` que quita `.js` de las importaciones relativas) | El proyecto es `"type": "module"` con `module: nodenext` e importaciones con extensión `.js`; ts-jest 29.4 admite TypeScript 6 y Jest 30. Se usan los globales de `@jest/globals` por importación explícita: **no** se instala `@types/jest`, que chocaría con `vitest/globals` |
| D3 | Archivos Jest `backend/test/jest/*.jest-spec.ts` | Vitest solo recoge `*.spec.ts`, `*.e2e-spec.ts` y `*.db-spec.ts`; Jest solo `*.jest-spec.ts`. Ninguno ejecuta las pruebas del otro |
| D4 | La suite Jest prueba **dominio y casos de uso** con los dobles en memoria existentes | Constitución II: `domain/` y `application/` no importan NestJS, Prisma ni Supabase, así que no hacen falta decoradores ni base de datos. La compatibilidad con decoradores y con Prisma se registra por separado (§4) |
| D5 | La cobertura global se define **una sola vez** en `backend/vitest.cobertura.ts` y se reutiliza en la configuración unitaria y en la HTTP | Evita medir cada ejecución con criterios distintos (causa de la cifra engañosa del 94,14 %) |
| D6 | **Definición de cobertura:** `include: src/**`; `exclude`: código generado por Prisma (`src/generated/**`), archivos de prueba (`**/*.spec.ts`, `**/*.e2e-spec.ts`, `**/*.db-spec.ts`), dobles de prueba (`**/test-doubles.ts`) y `**/*.d.ts` | Mide el código del sistema, no el de las pruebas ni el generado. **No** se excluyen `main.ts`, los `*.module.ts` ni los repositorios Prisma: cuentan aunque bajen la cifra |
| D7 | La combinación usa `vitest --reporter=blob` en cada ejecución y `vitest --merge-reports` con una única definición | Es la forma soportada de unir informes de dos configuraciones; unir LCOV a mano no es válido entre ejecuciones distintas |
| D8 | `npm run test:cov:todo` ejecuta ambas suites con una `DATABASE_URL` **ficticia** fijada por el script (`127.0.0.1:1`, sin servidor) | Las pruebas HTTP usan repositorios en memoria; `app.e2e-spec.ts` solo necesita que la variable exista. Garantiza que no se use una base real aunque exista `backend/.env` |
| D9 | Los umbrales se fijan **bajo** el resultado real medido (margen explícito) y solo en la ejecución combinada | Una ejecución parcial (solo unitarias) no puede fallar por umbrales que no le corresponden |

## 3. Suite representativa de Jest

Módulos elegidos por ser reglas de negocio críticas, sin base de datos y con dobles ya existentes:

| Archivo | Ejercita | Reglas |
|---|---|---|
| `stock.jest-spec.ts` | `inventory/domain/stock.ts` | Invariante 0 ≤ reservado ≤ físico, reservar/liberar/vender/variar, cantidades válidas (RF12–RF14; ADR-003) |
| `calculo-carrito.jest-spec.ts` | `cart/domain/calculo.ts` | Importes en céntimos, subtotales por puesto, total, líneas no vigentes (RF21–RF23) |
| `carrito.jest-spec.ts` | `cart/application/use-cases` | Solo clientes, varios puestos, tope de stock, límite de 50 productos, cantidad, quitar y vaciar (RF20–RF24) |
| `inventario.jest-spec.ts` | `inventory/application/use-cases` | Movimientos del titular, ajustes con motivo, reserva atómica e idempotente, liberación y venta (RF12–RF15; ADR-003) |
| `catalogo.jest-spec.ts` | `catalog/application/use-cases` | Validación de filtros, orden, precio y paginación (RF16–RF19) |

## 4. Compatibilidad evaluada

| Pieza | A verificar |
|---|---|
| TypeScript 6 y ESM con extensión `.js` | Debe resolverse con `moduleNameMapper` y ts-jest en modo ESM |
| Decoradores de NestJS | Se prueba con un controlador real (`CarritoController`) instanciado a mano; si falla, se registra el bloqueo |
| Prisma 7 (`@prisma/adapter-pg`, cliente generado) | Se comprueba si Jest puede cargar el cliente generado. **La suite no depende de él**; el resultado se registra, no se oculta |

## 5. Criterios de aceptación

| ID | Criterio (medible) | Evidencia |
|---|---|---|
| CA-COV-01 | `npm run test:jest` ejecuta la suite con Jest 30, sin red, PostgreSQL ni Supabase, y todas las pruebas pasan | Salida real |
| CA-COV-02 | Vitest no recoge los archivos `*.jest-spec.ts` y Jest no recoge los de Vitest; `npm test` y `npm run test:e2e` conservan sus recuentos anteriores (338 y 132) | Recuentos reales |
| CA-COV-03 | Jest genera su propio informe (`backend/coverage/jest/`: texto, HTML, LCOV y JSON) limitado a los archivos de los módulos probados y rotulado como **parcial** | Archivos generados |
| CA-COV-04 | La definición de cobertura de Vitest está en un solo archivo y las dos configuraciones la importan | Revisión; salida de las ejecuciones |
| CA-COV-05 | `npm run test:cov:todo` produce un informe combinado (unitarias + HTTP) en `backend/coverage/global/` con texto, HTML, LCOV y JSON, sobre los mismos archivos que las ejecuciones individuales | Archivos generados; recuento de archivos igual en las tres |
| CA-COV-06 | Los umbrales de la ejecución combinada están por debajo del resultado real, con margen declarado, y la ejecución falla si la cobertura baja de ellos | Prueba de que un umbral por encima del real hace fallar |
| CA-COV-07 | El resultado se compara con la línea base del 2026-11-18 (vista D: 74,89 / 71,36 / 80,16 / 77,08 %) explicando la diferencia de definición | `tasks.md` |
| CA-COV-08 | El CI ejecuta `npm run test:jest`, `npm run test:cov:todo` con su informe como artefacto y `npm test` del frontend, **además** de los controles existentes | `ci.yml`; ejecución del PR |
| CA-COV-09 | Sin cambios en `backend/src/modules/**`; sin Supabase, bases de datos ni contenedores; `lint`, `build`, `arquitectura` y `openapi:verificar` siguen correctos | `git diff`; resultados reales |
| CA-COV-10 | Las limitaciones están declaradas: la cobertura de Jest es parcial, la global no incluye `test:db`, y el CI no se ha ejecutado mientras no haya PR | `tasks.md` |

## 6. Limitaciones previstas

- La cobertura de los repositorios Prisma depende de `test:db` (PostgreSQL), que no se mide aquí.
- Ejecutar dos veces las suites en CI (una por los controles existentes y otra por la cobertura) alarga el trabajo del backend.
- Jest se ejecuta con `--experimental-vm-modules` (marca de Node para ESM en Jest).
- La cifra de cobertura mide líneas ejecutadas, no la calidad de las aserciones.
