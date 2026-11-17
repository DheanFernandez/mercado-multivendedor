# Guía de validación: interfaz del carrito

Prerrequisitos: Node 24, dependencias instaladas (`npm ci` en `backend/` y `frontend/`), Chromium de Playwright disponible. Las pruebas no usan Supabase ni el backend reales.

## Verificación automática (desde `frontend/`)

| Paso | Comando | Resultado esperado |
|---|---|---|
| Unitarias y de componente | `npm test` | todas en verde (cubren CA-F1…CA-F9, CA-F12) |
| Navegador con red simulada | `npm run test:e2e` | flujo cliente en verde: agregar desde el detalle, ver grupos y total, cambiar, quitar, error de stock, visitante y otro rol |
| Lint | `npm run lint` | sin errores |
| Compilación | `npm run build` | sin errores; aparece la ruta `/carrito` |

## Regresión del backend (desde `backend/`)

`npm run arquitectura`, `npm run lint`, `npm run build`, `npm test`, `npm run test:e2e`: sin cambios en resultados (el backend no se modifica).

## Validación manual opcional (no automatizada)

Con el backend real (`backend/.env` con base y Supabase propios) y `frontend/.env.local`: ingresar como cliente, abrir un producto, agregar, abrir `/carrito`, comprobar CA-F2…CA-F6 con productos de tres puestos. Esta guía **no** declara aprobado ese recorrido: solo se informa como ejecutado si se realiza.
