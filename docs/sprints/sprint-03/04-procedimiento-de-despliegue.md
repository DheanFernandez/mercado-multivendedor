# 04 · Procedimiento de despliegue

> **Estado: plantilla. Este procedimiento no se ha ejecutado.** Los pasos se basan en los comandos que ya existen en el repositorio; los que dependen del proveedor se completarán cuando se elija.

## 1. Requisitos previos

- [ ] Proveedores elegidos y registrados en un ADR ([01](01-arquitectura-de-despliegue.md#3-decisiones-pendientes)).
- [ ] Proyecto de Supabase de producción disponible.
- [ ] Variables de [03 · Configuración y seguridad](03-configuracion-y-seguridad.md) cargadas en el gestor de secretos del proveedor.
- [ ] Rama y commit que se despliegan, identificados y con la integración continua en verde.

## 2. Pasos

| # | Paso | Comando o acción existente | Verificación |
|---|---|---|---|
| 1 | Aplicar las migraciones a la base de producción, con autorización explícita | `npx prisma migrate deploy` desde `backend/`, con `DIRECT_URL` de producción | Ninguna migración pendiente |
| 2 | Compilar y arrancar el backend | `npm ci`, `npm run build` y `npm run start:prod` | `GET /` responde 200 |
| 3 | Compilar y arrancar el frontend con las variables `NEXT_PUBLIC_*` de producción | `npm ci`, `npm run build` y `npm start` | La página de inicio carga |
| 4 | Configurar en Supabase Auth las URL de redirección del dominio de producción | Panel de Supabase | El inicio de sesión y la recuperación de contraseña funcionan |
| 5 | Ejecutar las pruebas de humo | Ver [05 · Pruebas en producción](05-pruebas-en-produccion.md) | Todas pasan |
| 6 | Registrar la evidencia | Ver [evidencias](evidencias/README.md) | Carpeta con fecha, commit y resultados |

## 3. Reversión

Por definir según el proveedor. Como mínimo: volver a desplegar el commit anterior. Las migraciones de Prisma no se revierten automáticamente; antes de aplicar una migración destructiva se necesita un respaldo de la base de datos.
