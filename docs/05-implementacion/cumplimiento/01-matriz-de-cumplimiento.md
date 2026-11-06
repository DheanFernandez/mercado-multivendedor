# Matriz de cumplimiento real

> **Línea base congelada:** `docs/01-analisis-de-sistema/`, los diagramas C4 y los ADR no se modifican. Esta matriz **solo mide** el sistema contra ellos.
> **Fecha:** 2026-11-05 · **Commit base:** `23bd5d3` + cambios locales sin confirmar · **Evidencia vigente (hito H0):** [H0-2026-11-05](../evidencias/H0-2026-11-05/resumen.md) (la línea base previa está en `linea-base-2026-11-05`).

## 1. Cómo leer la matriz

**Estado real:** `Implementado` (existe y funciona), `Parcial` (existe una parte), `Pendiente` (no existe).

**Estado de cumplimiento** (compilar **no** cuenta como cumplir):

| Valor | Criterio |
|---|---|
| **CUMPLE** | Implementado **y** con prueba automatizada ejecutada hoy que verifica el comportamiento del requisito |
| **CUMPLE CON RESERVAS** | Implementado y con pruebas automáticas, pero falta verificar contra el servicio real o la interfaz, o la cobertura es incompleta |
| **PARCIAL** | Solo se cumple una parte del requisito |
| **NO CUMPLE** | Pendiente (no existe) |
| **NO MEDIDO** | (atributos de calidad) el umbral existe y nadie lo ha medido |

Los requisitos funcionales (RF) **no definen métrica numérica** en la documentación; su criterio es el comportamiento descrito. Las métricas y umbrales numéricos pertenecen a los atributos de calidad (§5) y a los escenarios EQ (ver [matriz de mediciones](03-matriz-de-mediciones.md)).

**Claves de evidencia** (rutas desde `backend/`; los resultados por prueba están en `docs/05-implementacion/evidencias/linea-base-2026-11-05/`):

| Clave | Archivo | Pruebas |
|---|---|---|
| T-USR | `src/modules/users/application/use-cases/usuarios.use-cases.spec.ts` | 23 |
| T-IDN | `src/modules/users/infrastructure/identity/supabase-identidad.adapter.spec.ts` | 9 |
| T-JWT | `src/modules/auth/infrastructure/jose-verificador-token.spec.ts` | 13 |
| T-AUT | `src/modules/auth/application/use-cases/autenticar-solicitud.use-case.spec.ts` | 5 |
| T-MER | `src/modules/merchants/application/use-cases/merchants.use-cases.spec.ts` | 11 |
| T-GME | `src/modules/merchants/application/use-cases/gestion-merchants.use-cases.spec.ts` | 13 |
| T-GUS | `src/modules/users/application/use-cases/gestion-usuarios.use-cases.spec.ts` | 15 |
| T-DOM | `src/modules/products/domain/dominio.spec.ts` | 39 |
| T-PRO | `src/modules/products/application/use-cases/productos.use-cases.spec.ts` | 25 |
| T-CAT | `src/modules/catalog/application/use-cases/catalogo.use-cases.spec.ts` | 16 |
| T-ALM | `src/shared/infrastructure/storage/supabase-almacen.adapter.spec.ts` | 14 |
| H-AUT | `test/autenticacion.e2e-spec.ts` (HTTP) | 21 |
| H-ADM | `test/administracion.e2e-spec.ts` (HTTP) | 22 |
| H-PRO | `test/productos.e2e-spec.ts` (HTTP) | 39 |
| H-H0 | `test/h0-administracion.e2e-spec.ts` (HTTP: alta de comerciante y puesto, roles, estados, edición, suspensión, protección entre comerciantes) | 18 |
| H-MAT | `test/matriz-autorizacion.e2e-spec.ts` (HTTP: 33 rutas × 6 identidades) | 3 |
| D-MOD | `test/modelo-restricciones.db-spec.ts` | 13 bloques; ejecutada hoy en la base **aislada** |
| D-PRO | `test/productos-persistencia.db-spec.ts` | 14 bloques; ejecutada hoy en la base **aislada** |
| D-H0 | `test/h0-persistencia.db-spec.ts` (rol/estado, edición, reasignación, puestos operativos, visibilidad en el catálogo) | 4; base **aislada** |
| UI | Páginas de `frontend/app/…` (sin pruebas automáticas; solo `lint` y `build`, ambos con código 0) | — |

## 2. Resumen

| Conjunto | Total | CUMPLE | CON RESERVAS | PARCIAL | NO CUMPLE |
|---|---|---|---|---|---|
| Requisitos funcionales RF01–RF55 | 55 | 5 | 7 | 2 | **41** |
| Historias de usuario HU01–HU29 (derivadas de sus RF) | 29 | 1 | 3 | 4 | **21** |
| Restricciones RC01–RC20 | 20 | 14 | 2 | 1 | 3 |
| Atributos de calidad AC01–AC12 | 12 | 1 | 0 | 4 | 2 (más 5 NO MEDIDO) |

**Lectura:** el núcleo de administración, productos y catálogo (hito H0) está construido y probado; **todo el flujo de compra (inventario, carrito, pedidos, pagos) y los módulos de soporte (auditoría, configuración, notificaciones, incidencias, reportes) no existen**. De los escenarios de calidad, **solo EQ-04 y EQ-03 están medidos** (cumplen); los otros seis siguen pendientes.

## 3. Requisitos funcionales

| ID | Funcionalidad | Módulo responsable | Estado real | Prueba requerida | Resultado medido | Evidencia | Cumplimiento |
|---|---|---|---|---|---|---|---|
| RF01 | Registrar usuarios | `users` + `auth` | Implementado | Unitaria + HTTP + flujo real con Supabase | Pruebas automáticas pasan; flujo real sin evidencia archivada | T-USR, T-IDN, H-AUT, H-ADM; `docs/05/01`, `02` | CUMPLE CON RESERVAS |
| RF02 | Autenticar con credenciales personales | `auth` (Supabase Auth) | Implementado | HTTP (JWT) + prueba de la interfaz de acceso | Verificación de JWT pasa; pantalla de acceso sin prueba | T-JWT, T-AUT, H-AUT; UI `app/login` | CUMPLE CON RESERVAS |
| RF03 | Identificar el rol del usuario | `auth` + `users` | Implementado | HTTP | Rol leído de PostgreSQL, cuenta sin perfil y desactivada → 403 | T-AUT, H-AUT | **CUMPLE** |
| RF04 | Mostrar solo funciones del rol | `frontend` + guard global | Implementado | HTTP (denegación) + prueba de interfaz | 403 verificado en backend; ocultamiento en interfaz sin prueba | H-AUT, H-ADM; UI `SiteHeader`, `Acceso` | CUMPLE CON RESERVAS |
| RF05 | Gestionar roles y permisos | `users` | Parcial: el administrador asigna roles y activa/desactiva cuentas (API y pantalla); **no hay modelo de permisos** (HU20) | Unitaria + HTTP | 15 + 3 pruebas de gestión de rol/estado pasan (incluye: nadie se asciende solo, el administrador no modifica su propia cuenta); permisos sin implementar | T-GUS, H-H0, H-MAT; `app/panel/usuarios` | PARCIAL |
| RF06 | Registrar y administrar comerciantes | `merchants` | Implementado: registrar, consultar, listar, editar nombre, suspender y reactivar (API y pantalla) | Unitaria + HTTP + BD | Pasan; suspender oculta los productos del catálogo (verificado en base aislada). Pantalla sin prueba automática ni verificación en navegador | T-MER, T-GME, H-ADM, H-H0, D-MOD, D-H0 | CUMPLE CON RESERVAS |
| RF07 | Registrar y administrar puestos | `merchants` | Implementado: registrar, listar, editar código y nombre, reasignar a otro comerciante activo, desactivar y reactivar (API y pantalla) | Unitaria + HTTP + BD | Pasan; desactivar oculta los productos. Pantalla sin prueba automática ni verificación en navegador | T-MER, T-GME, H-ADM, H-H0, D-MOD, D-H0 | CUMPLE CON RESERVAS |
| RF08 | Tiendas virtuales de los puestos | `merchants` (sin entidad) | Pendiente | HTTP + interfaz | — | — | NO CUMPLE |
| RF09 | Registrar, actualizar y desactivar productos | `products` | Implementado | Unitaria + HTTP + BD | 24 + 39 pruebas pasan | T-PRO, T-DOM, H-PRO, D-PRO | **CUMPLE** |
| RF10 | Asociar productos a categorías y puestos | `products` | Implementado | Unitaria + HTTP + BD | Pasan, incluida la propiedad del puesto | T-PRO, H-PRO, D-PRO | **CUMPLE** |
| RF11 | Gestionar precios, presentaciones e imágenes | `products` + Storage | Implementado | Unitaria + HTTP + prueba real de Storage | Precios y presentaciones pasan; imágenes con servicio simulado | T-DOM, T-ALM, H-PRO; `npm run storage:verificar` (preparado, **no ejecutado**: falta `SUPABASE_SERVICE_ROLE_KEY`) | CUMPLE CON RESERVAS |
| RF12 | Registrar y actualizar inventario | `inventory` | Implementado en el backend (ingreso, devolución y ajuste con deltas atómicos); **sin pantalla** | Unitaria + HTTP + BD | 40 unitarias + 8 HTTP + 25 de BD pasan | T-INV, H-INV, D-INV; `specs/001-inventario` | CUMPLE CON RESERVAS |
| RF13 | Movimientos de inventario | `inventory` | Implementado: libro de movimientos con tipo, variación, saldo, actor y referencia; **sin pantalla** | Unitaria + BD | Pasan (el libro cuadra con el stock bajo concurrencia) | T-INV, D-INV | CUMPLE CON RESERVAS |
| RF14 | Stock físico, reservado y disponible | `inventory` | Implementado (con `CHECK 0 ≤ reservado ≤ físico` en PostgreSQL); **sin pantalla** | Unitaria + BD | Pasan | T-INV, D-INV | CUMPLE CON RESERVAS |
| RF15 | Impedir cantidades superiores al stock | `inventory` | Implementado en la operación de reserva (UPDATE condicional atómico); **falta el pedido que la invoque** | Concurrencia (EQ-03) | 400 iteraciones concurrentes + k6 con 200 VUs: 0 reservas incompatibles | [EQ-03](../evidencias/EQ-03/2026-11-05/README.md) | PARCIAL |
| RF16 | Catálogo general multivendedor | `catalog` | Implementado | Unitaria + HTTP + BD | Pasan | T-CAT, H-PRO, D-PRO | **CUMPLE** |
| RF17 | Buscar productos por texto | `catalog` | Implementado | Unitaria + HTTP + BD | Pasan (búsqueda insensible a mayúsculas) | T-CAT, H-PRO, D-PRO | **CUMPLE** |
| RF18 | Filtrar por categoría, precio o puesto | `catalog` | Implementado: API con los tres filtros y pantalla con filtro por puesto (nuevo, usa `GET /puestos/publicos`) | Unitaria + HTTP + BD + interfaz | API probada; la pantalla no tiene prueba automática | T-CAT, H-PRO, D-PRO, H-H0; UI `app/catalogo` | CUMPLE CON RESERVAS |
| RF19 | Detalle y disponibilidad de un producto | `catalog` + `inventory` | Parcial: detalle sí, disponibilidad no | HTTP | Detalle probado | H-PRO; UI `app/catalogo/[id]` | PARCIAL |
| RF20 | Productos de varios puestos en un carrito | `cart` | Pendiente | HTTP | — | — | NO CUMPLE |
| RF21 | Identificar el puesto de cada ítem | `cart` | Pendiente | Unitaria | — | — | NO CUMPLE |
| RF22 | Subtotal por puesto | `cart` | Pendiente | Unitaria (importes exactos) | — | — | NO CUMPLE |
| RF23 | Total general | `cart` | Pendiente | Unitaria | — | — | NO CUMPLE |
| RF24 | Modificar o eliminar ítems | `cart` | Pendiente | HTTP | — | — | NO CUMPLE |
| RF25 | Reverificar stock antes de confirmar | `orders` + `inventory` | Pendiente | Concurrencia (EQ-03) | — | — | NO CUMPLE |
| RF26 | Registrar pedido de uno o varios puestos | `orders` | Pendiente | HTTP + BD (EQ-02) | — | — | NO CUMPLE |
| RF27 | Código único por pedido | `orders` | Pendiente | Unitaria + BD | — | — | NO CUMPLE |
| RF28 | Asociar pedido a su cliente | `orders` | Pendiente | HTTP + BD | — | — | NO CUMPLE |
| RF29 | Agrupar productos por puesto (subpedidos) | `orders` | Pendiente | Unitaria + BD (EQ-02) | — | — | NO CUMPLE |
| RF30 | Consultar estado general del pedido | `orders` | Pendiente | HTTP | — | — | NO CUMPLE |
| RF31 | Historial de cambios de estado | `orders` | Pendiente | Unitaria + BD | — | — | NO CUMPLE |
| RF32 | Mostrar subtotales y total antes de pagar | `payments` + `orders` | Pendiente | HTTP + interfaz | — | — | NO CUMPLE |
| RF33 | Actualizar el estado del pago automáticamente | `payments` | Pendiente | HTTP (EQ-01, EQ-08) | — | — | NO CUMPLE |
| RF34 | Mostrar al comerciante el estado del pago, sin validación manual | `payments` + `orders` | Pendiente | HTTP | — | — | NO CUMPLE |
| RF35 | Impedir preparar sin pago aprobado | `orders` + `payments` | Pendiente | Unitaria + HTTP | — | — | NO CUMPLE |
| RF36 | Registrar la preparación | `orders` | Pendiente | HTTP | — | — | NO CUMPLE |
| RF37 | Variaciones de peso o precio | `orders` | Pendiente | Unitaria | — | — | NO CUMPLE |
| RF38 | Actualizar estado en pago, preparación y retiro | `orders` | Pendiente | Unitaria (máquina de estados) | — | — | NO CUMPLE |
| RF39 | Marcar listo para retiro y registrar la entrega | `orders` | Pendiente | HTTP | — | — | NO CUMPLE |
| RF40 | Cancelaciones, devoluciones e incidencias con reembolsos | `incidencias` (sin crear) + `payments` | Pendiente | HTTP | — | — | NO CUMPLE |
| RF41 | Notificaciones de cambios de estado | `notificaciones` (sin crear) | Pendiente | Unitaria + HTTP (EQ-06) | — | — | NO CUMPLE |
| RF42 | Auditoría de operaciones críticas | `auditoria` (sin crear) | Pendiente | HTTP + BD (EQ-01, EQ-08) | — | — | NO CUMPLE |
| RF43 | Administrador consulta pedidos, pagos, incidencias y conciliación | `reportes` (sin crear) | Pendiente | HTTP | — | — | NO CUMPLE |
| RF44 | Reportes, indicadores y paneles | `reportes` (sin crear) | Pendiente | HTTP + interfaz | — | — | NO CUMPLE |
| RF45 | Reglas operativas configurables | `configuracion` (sin crear) | Pendiente | HTTP + BD | — | — | NO CUMPLE |
| RF46 | Comerciante consulta pedidos y ventas de sus puestos | `orders` / `reportes` | Pendiente | HTTP (aislamiento) | — | — | NO CUMPLE |
| RF47 | Iniciar el pago único y redirigir al Checkout | `payments` | Pendiente | HTTP + Sandbox | — | — | NO CUMPLE |
| RF48 | Recibir Webhook, verificar firma y confirmar con la API | `payments` | Pendiente | HTTP (EQ-01) | — | — | NO CUMPLE |
| RF49 | Procesamiento idempotente | `payments` | Pendiente | HTTP (EQ-08) | — | — | NO CUMPLE |
| RF50 | Conciliación periódica | `payments` | Pendiente | Integración (EQ-08) | — | — | NO CUMPLE |
| RF51 | Reembolsos totales o parciales | `payments` | Pendiente | HTTP + Sandbox | — | — | NO CUMPLE |
| RF52 | Vincular y desvincular la cuenta de Mercado Pago | `merchants` + `payments` | Pendiente | HTTP | — | — | NO CUMPLE |
| RF53 | Registrar comisión e importe neto por puesto | `payments` | Pendiente | Unitaria + BD | — | — | NO CUMPLE |
| RF54 | Vencimiento del pago ligado a la reserva | `payments` + `inventory` | Pendiente | Integración (ADR-003 §10 pruebas 6–8) | — | — | NO CUMPLE |
| RF55 | Comerciante consulta cobros, comisiones y netos | `payments` | Pendiente | HTTP + interfaz | — | — | NO CUMPLE |

## 4. Historias de usuario

El cumplimiento de una historia se **deriva** de los RF de la tabla «Relación entre historias de usuario y requisitos funcionales» (`03-requisitos-funcionales.md`): solo es CUMPLE si todos sus RF cumplen.

| HU | Historia (resumen) | RF | Estado real | Cumplimiento |
|---|---|---|---|---|
| HU01 | Consultar productos de varios puestos | RF16, RF19 | Parcial (sin disponibilidad) | PARCIAL |
| HU02 | Buscar y filtrar | RF17, RF18 | Implementado (con filtro por puesto en pantalla) | CUMPLE CON RESERVAS |
| HU03 | Detalle del producto con disponibilidad | RF19 | Parcial | PARCIAL |
| HU04 | Carrito multivendedor | RF20, RF21 | Pendiente | NO CUMPLE |
| HU05 | Modificar el carrito | RF24 | Pendiente | NO CUMPLE |
| HU06 | Subtotales y total | RF22, RF23 | Pendiente | NO CUMPLE |
| HU07 | Generar pedido | RF25–RF29 | Pendiente | NO CUMPLE |
| HU08 | Pagar en una sola transacción | RF32, RF33, RF47–RF49, RF54 | Pendiente | NO CUMPLE |
| HU09 | Consultar estado del pedido | RF30, RF31, RF33, RF38 | Pendiente | NO CUMPLE |
| HU10 | Retirar el pedido en el puesto | RF39 | Pendiente | NO CUMPLE |
| HU11 | Gestionar tienda y comprobar vinculación | RF08, RF52 | Pendiente | NO CUMPLE |
| HU12 | Registrar y actualizar productos | RF09, RF10 | Implementado | **CUMPLE** |
| HU13 | Precios y presentaciones | RF11 | Implementado | CUMPLE CON RESERVAS |
| HU14 | Gestionar inventario | RF12, RF14, RF15 | Implementado en el backend; sin pantalla | CUMPLE CON RESERVAS |
| HU15 | Movimientos de inventario | RF13 | Implementado en el backend; sin pantalla | CUMPLE CON RESERVAS |
| HU16 | Operaciones de mi puesto | RF46, RF44 | Pendiente | NO CUMPLE |
| HU17 | Pedidos con pago aprobado | RF34, RF35 | Pendiente | NO CUMPLE |
| HU18 | Variaciones de peso o precio | RF37 | Pendiente | NO CUMPLE |
| HU19 | Preparar y entregar | RF36, RF38, RF39 | Pendiente | NO CUMPLE |
| HU20 | Trabajador: solo funciones autorizadas | RF03, RF04, RF05 | Parcial (el rol existe sin atribuciones) | PARCIAL |
| HU21 | Administrador gestiona usuarios | RF01–RF05 | Parcial (roles y activación disponibles; faltan permisos) | PARCIAL |
| HU22 | Administrador gestiona comerciantes y puestos | RF06, RF07 | Implementado | CUMPLE CON RESERVAS |
| HU23 | Pedidos, conciliación e incidencias | RF40, RF43, RF50 | Pendiente | NO CUMPLE |
| HU24 | Configurar reglas operativas | RF45 | Pendiente | NO CUMPLE |
| HU25 | Reportes | RF44 | Pendiente | NO CUMPLE |
| HU26 | Auditoría | RF42 | Pendiente | NO CUMPLE |
| HU27 | Vincular cuenta de Mercado Pago | RF52 | Pendiente | NO CUMPLE |
| HU28 | Cobros y comisiones | RF53, RF55 | Pendiente | NO CUMPLE |
| HU29 | Reembolsos | RF40, RF51 | Pendiente | NO CUMPLE |

## 5. Restricciones y atributos de calidad

### 5.1 Restricciones (RC)

| ID | Restricción | Estado | Evidencia | Cumplimiento |
|---|---|---|---|---|
| RC01 | Web responsive preparada para PWA | Parcial: responsive; sin manifiesto ni service worker; sin medición con Lighthouse | `frontend/` | PARCIAL |
| RC02 | Frontend con Next.js | Implementado (Next.js 16) | `frontend/package.json` | CUMPLE |
| RC03 | TypeScript en el frontend | Implementado | `frontend/tsconfig.json` | CUMPLE |
| RC04 | Backend con NestJS | Implementado (NestJS 12) | `backend/package.json` | CUMPLE |
| RC05 | TypeScript en el backend | Implementado | `backend/tsconfig.json` | CUMPLE |
| RC06 | API REST | Implementado | rutas `/api/v1` | CUMPLE |
| RC07 | PostgreSQL | Implementado | `backend/prisma/` | CUMPLE |
| RC08 | Supabase | Implementado: base de datos y Auth en uso | `.env.example`, migraciones | CUMPLE |
| RC09 | Archivos en Supabase Storage | Implementado con servicio simulado; real sin verificar | T-ALM; `storage:verificar` no ejecutado | CUMPLE CON RESERVAS |
| RC10 | Git y repositorio en GitHub | Implementado | remoto `github.com/DheanFernandez/mercado-multivendedor` | CUMPLE |
| RC11 | Equipo reducido y despliegue simple (una aplicación) | Implementado: un backend y un frontend | estructura del repositorio | CUMPLE |
| RC12 | Enfoque modular | Implementado con deuda: 6 importaciones internas entre módulos y lectura de tablas ajenas por `catalog` | `docs/06-gobernanza-sdd/03-…` | CUMPLE CON RESERVAS |
| RC13 | Pago único con Mercado Pago (Sandbox) | Pendiente | — | NO CUMPLE |
| RC14 | Integración con Mercado Pago y vinculación | Pendiente | — | NO CUMPLE |
| RC15 | Sin app móvil nativa | No existe (conforme) | — | CUMPLE |
| RC16 | Sin SUNAT | No existe (conforme) | — | CUMPLE |
| RC17 | Sin delivery | No existe (conforme) | — | CUMPLE |
| RC18 | Sin hardware especializado | No existe (conforme) | — | CUMPLE |
| RC19 | Sin RENIEC | No existe (conforme) | — | CUMPLE |
| RC20 | Desplegable y accesible por Internet | **No hay despliegue** ni plan de despliegue | — | NO CUMPLE |

### 5.2 Atributos de calidad (AC) y sus criterios de evaluación

Los umbrales están **copiados** de `04-atributos-de-calidad.md`.

| ID | Atributo | Módulo | Métrica y umbral (documentación) | Resultado medido | Evidencia | Cumplimiento |
|---|---|---|---|---|---|---|
| AC01 | Rendimiento | `catalog` y otros | 100 usuarios concurrentes: ≥ 95 % de las consultas del catálogo en < 2 s | **p95 = 381,4 ms** con 100 usuarios virtuales durante 2 min (10 886 solicitudes, 0 errores); prueba de esfuerzo máximo: p95 = 1 043 ms. Entorno local aislado (ver limitaciones) | [EQ-04](../evidencias/EQ-04/2026-11-05/README.md) | **CUMPLE** (en entorno aislado) |
| AC02 | Escalabilidad | todos | Incorporar comerciantes y puestos sin modificar la estructura de los módulos | Ninguno; el alta por datos funciona, pero el flujo de compra no existe | H-ADM (alta de comerciantes y puestos por API) | NO MEDIDO (EQ-05) |
| AC03 | Disponibilidad | `payments`, `notificaciones` | Recuperarse de fallos temporales sin perder operaciones confirmadas; con Mercado Pago caído, catálogo, carrito y preparación siguen operativos; sin pedidos con pago indefinido; conciliación ≤ 15 min | Ninguno | — (EQ-06, EQ-08 pendientes) | NO MEDIDO |
| AC04 | Seguridad | `auth` y todos | Sin accesos fuera de los permisos del rol; **pagos:** 100 % de Webhooks inválidos rechazados, tokens de comerciantes cifrados | **Usuarios:** 198 de 198 casos conformes (33 rutas × 6 identidades) tras corregir 1 defecto detectado por la propia matriz; sin análisis OWASP ZAP; **pagos:** inexistente | [AC04](../evidencias/AC04/2026-11-05/matriz-autorizacion.md) | PARCIAL |
| AC05 | Mantenibilidad | todos | Cambiar un módulo sin modificar innecesariamente reglas de otros | Ninguno medido; 6 importaciones internas entre módulos | — | NO MEDIDO |
| AC06 | Observabilidad | `auditoria`, `payments` | Registrar el 100 % de las notificaciones con identificador, fecha y resultados | No existe registro estructurado ni auditoría (solo el logger por defecto de NestJS) | — | NO CUMPLE |
| AC07 | Concurrencia | `inventory` | Dos clientes no confirman reservas incompatibles sobre el mismo stock | 400 de 400 iteraciones correctas (N = 2, 5, 20 con stock 1; 200 clientes con S = 10) y k6 con 200 VUs: exactamente 10 reservas aceptadas, `reservado > físico` = 0. Se mide la operación de reserva, no un pedido completo | [EQ-03](../evidencias/EQ-03/2026-11-05/README.md) | **CUMPLE** en la operación de reserva (repetir con pedidos) |
| AC08 | Integridad | `orders`, `inventory`, `payments` | Operaciones críticas se completan o se revierten sin dejar registros inconsistentes | Solo existe la escritura transaccional de producto e imágenes, sin prueba de fallo | D-PRO | PARCIAL |
| AC09 | Usabilidad | frontend | Pago en 1 transacción; Checkout en ≤ 2 acciones desde la confirmación del pedido | Interfaz responsive sin medición; el flujo de pago no existe | UI | PARCIAL |
| AC10 | Compatibilidad | frontend | Sin umbral numérico en la documentación | Ninguno | — | NO MEDIDO |
| AC11 | Recuperabilidad | todos | Sin umbral numérico en la documentación | Ninguno | — | NO MEDIDO |
| AC12 | Privacidad | `merchants`, `products` | Sin umbral numérico; información visible solo a usuarios autorizados | Aislamiento entre comerciantes probado en los módulos implementados | H-ADM, H-PRO | PARCIAL |

Resumen de AC: 2 CUMPLE (AC01, AC07) · 4 PARCIAL (AC04, AC08, AC09, AC12) · 1 NO CUMPLE (AC06) · 5 NO MEDIDO (AC02, AC03, AC05, AC10, AC11).

## 6. Discrepancias del diagnóstico respecto de informes anteriores

- Se corrige el conteo de pruebas de base de datos: son 27 bloques `it` (13 + 14), que se ejecutan como 28 pruebas; la cifra de «29» mencionada antes era errónea. **No se reejecutaron hoy** para no tocar la base compartida.
- Se corrige el número de importaciones internas entre módulos: **6**, no 4 (ver `docs/06-gobernanza-sdd/01-revision-de-consistencia.md`).
