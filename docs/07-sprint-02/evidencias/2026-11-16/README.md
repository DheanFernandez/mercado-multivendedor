# Evidencias de la evaluación del Sprint 02 · 2026-11-16

Verificaciones **de solo lectura** ejecutadas durante la evaluación del Sprint 02. No se usó ninguna base de datos (ni PostgreSQL local ni Supabase), no se aplicaron migraciones ni semillas y no se ejecutó k6. El entorno está en [`entorno.txt`](entorno.txt).

## Versión evaluada y aplicabilidad a `main`

Las tres verificaciones de la tabla «Resultados» se ejecutaron sobre la rama local `feat/pedidos-backend` (commit `a3f0cd0`, **no publicado en GitHub**), con cambios sin confirmar en el árbol de trabajo. El repositorio publicado es `origin/main` (`1aab552`). Después, AC05 se repitió sobre `origin/main` en un worktree limpio ([AC05-arquitectura-main](AC05-arquitectura-main/README.md)).

| Verificación | ¿Vale para `origin/main`? |
|---|---|
| AC04 | **Sí.** `test/matriz-autorizacion.e2e-spec.ts`, `test/helpers/app-en-memoria.ts` y todos los controladores son idénticos en ambas versiones (`git diff origin/main HEAD` vacío para esos archivos) |
| AC05 | **No**, porque el código analizado incluye Pedidos y la unidad de trabajo, que solo existen en la rama local. Para `main` vale la medición propia: [AC05-arquitectura-main](AC05-arquitectura-main/README.md), con 0 violaciones en 106 módulos sobre `1aab552` |
| EQ-02 (parcial) | **No.** Las pruebas de `orders` solo existen en la rama local |

Las mediciones previas (EQ-03, EQ-04 y AC04 del 2026-11-05) **no se repitieron**; se citan desde [`docs/05-implementacion/evidencias/`](../../../05-implementacion/evidencias/) tras verificar que sus JSON coinciden con lo que afirman sus README (ver el [informe de evaluación](../../02-evaluacion-atributos-calidad.md#6-verificación-del-origen-de-las-evidencias)).

## Resultados

| ID | Qué se verifica | Comando (desde `backend/`) | Resultado | Veredicto |
|---|---|---|---|---|
| AC04 | Autorización rol × ruta: anónimo → 401, sin permiso → 403, con permiso → autorizado | `EVIDENCIA_DIR=<carpeta> npx vitest run --config ./vitest.config.e2e.ts test/matriz-autorizacion.e2e-spec.ts` | **252 de 252 casos conformes** (42 rutas × 6 identidades); 3 de 3 pruebas pasan, incluida «cubre todas las rutas declaradas en los controladores» | Criterio de AC04 (usuarios) satisfecho en las rutas existentes |
| AC05 | Reglas de arquitectura de [`.dependency-cruiser.cjs`](../../../../backend/.dependency-cruiser.cjs): límites entre módulos solo por `index.ts` o `*.module.ts`; `domain/` y `application/` sin NestJS, Prisma, `pg` ni `jose`; SDK de Mercado Pago solo en su adaptador; sin ciclos. Todas con severidad `error` | `npx depcruise src --config .dependency-cruiser.cjs` | **0 violaciones** (133 módulos, 447 dependencias) en la rama local | Evidencia estructural favorable; **no** equivale a EQ-07 |
| AC05 (`main`) | Las mismas cuatro reglas, sobre `origin/main` (`1aab552`) en un worktree limpio | `npx depcruise src --config .dependency-cruiser.cjs` | **0 violaciones** (106 módulos, 365 dependencias) | Igual que la anterior; detalle en [AC05-arquitectura-main](AC05-arquitectura-main/README.md) |
| EQ-02 (parcial) | `CrearPedido` con fallo forzado tras cada paso de la unidad de trabajo, con **dobles en memoria** | `npx vitest run src` | 7 de 7 casos pasan (dentro de 558 de 558 pruebas unitarias) | Prueba de diseño del caso de uso; **no** es la medición EQ-02 (falta PostgreSQL, tareas T016 y T026) |

### Rutas añadidas a la matriz AC04 desde el 2026-11-05

La matriz pasó de 33 a 42 rutas: `GET /api/v1/inventario`, `GET /api/v1/inventario/productos/:id`, `GET /api/v1/inventario/productos/:id/movimientos`, `POST /api/v1/inventario/productos/:id/movimientos`, `GET /api/v1/carrito`, `DELETE /api/v1/carrito`, `POST /api/v1/carrito/items`, `PATCH /api/v1/carrito/items/:id` y `DELETE /api/v1/carrito/items/:id`. El módulo `orders` aún no expone rutas (tareas T014 y T015 pendientes), por lo que no forma parte de la matriz.

Herramientas: Vitest 4.1.12, Supertest y dependency-cruiser 18.7.2, sobre Node v24.19.0.

## Campos exigidos para cada evidencia

| Campo | Dónde está |
|---|---|
| Fecha | Título de este documento y `entorno.txt` |
| Entorno | `entorno.txt`: equipo, sistema operativo, Node y npm |
| Versión o commit evaluado | Sección «Versión evaluada» y `entorno.txt` |
| Herramienta | Línea «Herramientas» y `entorno.txt` |
| Comando | Columna «Comando» de la tabla de resultados |
| Resultado | Tabla de resultados y archivos de salida |
| Limitaciones | Sección «Limitaciones» |

## Archivos

| Archivo | Contenido |
|---|---|
| `AC04/matriz-autorizacion.md` y `.json` | Informe generado por la propia prueba (tabla rol × ruta y resultados por caso) |
| `AC04/salida-vitest.txt` | Salida de consola de Vitest |
| `AC05-arquitectura/salida-depcruise.txt` | Salida de dependency-cruiser sobre la rama local |
| `AC05-arquitectura-main/README.md` y `salida-depcruise.txt` | Medición sobre `origin/main`: commit, fecha, entorno, herramienta, comando, resultado y limitaciones |
| `unitarias/resumen.json` | Resumen por archivo de las 558 pruebas unitarias y detalle de los 7 casos EQ-02 |
| `unitarias/salida-vitest.txt` | Salida de consola de Vitest. La ruta local del informe JSON se sustituyó por `<carpeta temporal local>`; su contenido está resumido en `resumen.json` |
| `entorno.txt` | Equipo, versiones, rama, commit y estado del árbol de trabajo |

## Limitaciones (obligatorio al citar estos resultados)

1. **Rama local con cambios sin confirmar.** Rama `feat/pedidos-backend`, commit `a3f0cd0`, no publicado. En el backend, los cambios sin confirmar afectan a `package.json` (solo scripts) y al adaptador de Storage, que no tocan las reglas de autorización ni `orders`. Los archivos sin seguimiento de `backend/scripts/` (base de desarrollo y demo) quedan fuera de `src/` y no forman parte de ninguna de las tres verificaciones.
2. **AC04** verifica la autorización de cada ruta con repositorios en memoria, sin Supabase ni base de datos. No mide las reglas de negocio de cada operación, ni la parte de pagos del criterio (Webhook inválido, tokens cifrados), ni vulnerabilidades generales (OWASP ZAP no se ejecutó).
3. **AC05.** dependency-cruiser comprueba importaciones, pero no el acceso a tablas. El catálogo sigue consultando con Prisma el modelo `producto` e incluye `categoria` y `puesto` (hallazgo C-05, pendiente de DEC-03). La regla del SDK de Mercado Pago se cumple porque el SDK no está instalado: el módulo `payments` está vacío.
4. **EQ-02 (parcial).** Los dobles en memoria no prueban la atomicidad real de PostgreSQL. Esa parte la cubren las pruebas `*.db-spec.ts` de la unidad de trabajo, que **no se ejecutaron en esta evaluación** para no usar ninguna base de datos.
5. **Incidencia del entorno, no de las pruebas.** Las dos primeras ejecuciones de Vitest fallaron al cargar los archivos (`Cannot read properties of undefined (reading 'config')`) porque la ruta de trabajo empezaba por `d:/` en minúscula, y Vitest cargaba el módulo dos veces. Repetidas desde `D:/` pasaron sin cambios en el código. Para reproducirlas en Windows conviene abrir la terminal en `D:\…`.
