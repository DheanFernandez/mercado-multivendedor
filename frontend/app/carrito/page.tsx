"use client";

import { Acceso } from "@/components/panel/Acceso";
import { CarritoVista } from "@/components/carrito/CarritoVista";

/**
 * Carrito del cliente (spec 002-carrito, CA-F8). Sin sesión redirige al login y otros roles ven «Acceso restringido».
 * Es solo experiencia de usuario: el backend autoriza cada operación del carrito (R1).
 */
export default function PaginaCarrito() {
  return (
    <Acceso roles={["CLIENTE"]} titulo="Mi carrito">
      {() => <CarritoVista />}
    </Acceso>
  );
}
