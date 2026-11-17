# Contrato HTTP consumido: `/api/v1/carrito` (existente, sin cambios)

Implementado en `backend/src/modules/cart/entry-adapters/carrito.controller.ts` (commit `64bf830`, integrado en `main` `1aab552`). Requiere `Authorization: Bearer <JWT de Supabase>`; solo el rol `CLIENTE`.

| Operación | Método y ruta | Cuerpo | Éxito |
|---|---|---|---|
| Consultar | `GET /api/v1/carrito` | — | 200 + Carrito |
| Agregar (suma si existe) | `POST /api/v1/carrito/items` | `{ productoId: uuid, cantidad: entero 1–10000 }` | 201 + Carrito |
| Fijar cantidad | `PATCH /api/v1/carrito/items/:productoId` | `{ cantidad }` | 200 + Carrito |
| Quitar | `DELETE /api/v1/carrito/items/:productoId` | — | 200 + Carrito |
| Vaciar | `DELETE /api/v1/carrito` | — | 200 + Carrito vacío |

## Respuesta Carrito

```json
{
  "puestos": [
    {
      "puesto": { "id": "uuid", "codigo": "A-1", "nombre": "Puesto A" },
      "items": [
        { "productoId": "uuid", "nombre": "Mango", "unidadVenta": "KILOGRAMO", "presentacion": null,
          "cantidad": 3, "precioUnitario": "6.50", "subtotal": "19.50", "estado": "OK", "disponible": 10 }
      ],
      "subtotal": "19.50"
    }
  ],
  "total": "19.50", "totalProductos": 3, "requiereRevision": false
}
```

## Errores (cuerpo `{ statusCode, codigo, mensaje }`)

| Estado | Cuándo | Tratamiento en la interfaz |
|---|---|---|
| 400 | entrada inválida | mostrar `mensaje` junto a la acción |
| 401 | sin sesión o token inválido/caducado | cerrar sesión local y redirigir a `/login` |
| 403 | rol distinto de cliente | «acceso restringido» (la interfaz ya lo evita con `Acceso`) |
| 404 | producto no disponible / no está en el carrito | mostrar `mensaje`; recargar el carrito |
| 409 | stock insuficiente (incluye unidades disponibles) o límite de 50 productos | mostrar `mensaje`; conservar el carrito mostrado |
| 0 (red) | sin conexión con el servidor | «No se pudo conectar con el servidor.» (ya lo genera `peticion`) |
