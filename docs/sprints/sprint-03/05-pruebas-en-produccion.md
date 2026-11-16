# 05 · Pruebas de funcionamiento en producción

> **Estado: plantilla. Ninguna prueba se ha ejecutado en producción.**

## 1. Pruebas de humo

Usan rutas que existen hoy y que son accesibles sin sesión, según la matriz de autorización del Sprint 02 ([AC04](../../07-sprint-02/evidencias/2026-11-16/AC04/matriz-autorizacion.md)).

| # | Prueba | Resultado esperado | Resultado obtenido |
|---|---|---|---|
| H-1 | `GET /` | 200 | — |
| H-2 | `GET /api/v1/categorias` | 200 | — |
| H-3 | `GET /api/v1/puestos/publicos` | 200 | — |
| H-4 | `GET /api/v1/catalogo/productos` | 200 | — |
| H-5 | Ruta protegida sin token (por ejemplo, `GET /api/v1/auth/me`) | 401 | — |
| H-6 | Registro, inicio de sesión y recuperación de contraseña desde la aplicación web | Flujo completo sin errores | — |
| H-7 | Petición desde un origen distinto de `FRONTEND_URL` | Rechazada por CORS | — |

## 2. Mediciones de calidad en producción

| Medición | Por qué en producción | Herramienta | Precaución |
|---|---|---|---|
| EQ-04 · Rendimiento del catálogo | La medición del Sprint 02 fue local, sin red ni Supabase | k6, con el mismo guion [`ops/k6/catalogo.js`](../../../ops/k6/catalogo.js) | Acordar la carga y el horario para no agotar los límites del plan de Supabase |
| Lighthouse de la aplicación web | Pendiente desde el Sprint 02 | Lighthouse | — |
| AC03 · Disponibilidad | La meta numérica sigue sin definirse (EQ-06) | Monitor de disponibilidad (por elegir) | Primero definir la meta |
| EQ-05 · Alta de puestos sin cambios de código | Requiere el flujo de compra completo | Playwright | Depende de Pedidos y Pagos |

## 3. Criterio de aceptación

El despliegue se considera verificado cuando H-1 a H-7 pasan y su evidencia está registrada. Las mediciones de la §2 se informan con sus limitaciones, aunque no se cumplan.
