"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Aviso, Entrada, claseBoton } from "@/components/comun";
import { agregarAlCarrito } from "@/lib/api";
import { mensajeErrorCarrito, validarCantidad } from "@/lib/carrito";
import { precioTexto } from "@/lib/formato";
import { useSesion } from "@/lib/hooks";
import type { Carrito } from "@/lib/tipos";
import { useSesionCaducada } from "@/lib/useSesionCaducada";

/**
 * Bloque de compra del detalle del producto (spec 002-carrito, CA-F1 y CA-F8).
 * Ocultar o mostrar controles según el rol es solo experiencia de usuario: el servidor autoriza cada operación.
 */
export function ComprarProducto({ productoId }: { productoId: string }) {
  const sesion = useSesion();
  const sesionCaducada = useSesionCaducada();
  const [cantidad, setCantidad] = useState("1");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agregado, setAgregado] = useState<Carrito | null>(null);

  if (sesion.estado === "cargando") return null;
  if (sesion.estado === "visitante") {
    return (
      <Link href="/login" className={claseBoton("primario")}>
        Ingresar para comprar
      </Link>
    );
  }
  if (sesion.estado === "otro") return <Aviso tipo="info">Solo los clientes compran en el marketplace.</Aviso>;

  async function agregar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando) return;
    const v = validarCantidad(cantidad);
    setAgregado(null);
    if (!v.ok) return setError(v.mensaje);
    setError(null);
    setEnviando(true);
    try {
      setAgregado(await agregarAlCarrito(productoId, v.valor));
    } catch (err) {
      if (!sesionCaducada(err)) setError(mensajeErrorCarrito(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={agregar} noValidate className="space-y-3">
      <div className="max-w-[10rem]">
        <Entrada etiqueta="Cantidad" name="cantidad" inputMode="numeric" autoComplete="off" value={cantidad} onChange={(e) => setCantidad(e.target.value)} disabled={enviando} />
      </div>
      <button type="submit" className={claseBoton("primario")} disabled={enviando}>
        {enviando ? "Agregando…" : "Agregar al carrito"}
      </button>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {agregado && (
        <Aviso tipo="ok">
          Agregado al carrito. Total estimado: {precioTexto(agregado.total)}.{" "}
          <Link href="/carrito" className="font-medium underline">
            Ver mi carrito
          </Link>
        </Aviso>
      )}
    </form>
  );
}
