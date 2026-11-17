/** Fixtures compartidos de las pruebas del carrito (spec 002-carrito, T009). */
import type { Carrito, LineaCarrito } from "@/lib/tipos";

export const linea = (p: Partial<LineaCarrito> = {}): LineaCarrito => ({
  productoId: "00000000-0000-4000-8000-000000000501", nombre: "Mango", unidadVenta: "KILOGRAMO", presentacion: null,
  cantidad: 3, precioUnitario: "6.50", subtotal: "19.50", estado: "OK", disponible: 10, ...p,
});

export const PUESTOS = {
  A: { id: "pa", codigo: "A-1", nombre: "Puesto A" },
  B: { id: "pb", codigo: "B-1", nombre: "Puesto B" },
  C: { id: "pc", codigo: "C-1", nombre: "Puesto C" },
};

/** Carrito de tres puestos con importes que delatarían sumas en coma flotante (0.30, 59.97). */
export const carritoTresPuestos = (): Carrito => ({
  puestos: [
    { puesto: PUESTOS.A, items: [linea({ productoId: "m", nombre: "Mango", cantidad: 3, precioUnitario: "6.50", subtotal: "19.50" })], subtotal: "19.50" },
    { puesto: PUESTOS.B, items: [linea({ productoId: "c", nombre: "Cilantro", cantidad: 3, precioUnitario: "0.10", subtotal: "0.30", unidadVenta: "MANOJO" })], subtotal: "0.30" },
    { puesto: PUESTOS.C, items: [linea({ productoId: "p", nombre: "Palta", cantidad: 3, precioUnitario: "19.99", subtotal: "59.97" })], subtotal: "59.97" },
  ],
  total: "79.77", totalProductos: 9, requiereRevision: false,
});

export const carritoVacio = (): Carrito => ({ puestos: [], total: "0.00", totalProductos: 0, requiereRevision: false });
