"use client";

import { type FormEvent, useState } from "react";
import { Aviso } from "@/components/comun";
import { IconoCanasta, IconoMas, IconoMenos, IconoPapelera } from "@/components/iconos";
import { actualizarCantidadCarrito, quitarDelCarrito } from "@/lib/api";
import { MAX_CANTIDAD, mensajeErrorCarrito, textoEstadoLinea, validarCantidad } from "@/lib/carrito";
import { precioTexto, unidadCorta } from "@/lib/formato";
import type { Carrito, LineaCarrito as Linea } from "@/lib/tipos";
import { useSesionCaducada } from "@/lib/useSesionCaducada";

const claseBotonPaso =
  "flex h-8 w-8 items-center sm:h-9 sm:w-9 justify-center rounded-full text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-35 dark:text-zinc-200 dark:hover:bg-zinc-800";
const claseAccionTexto =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm sm:px-3 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Una línea del carrito (spec 002-carrito, CA-F2, CA-F4–CA-F7, CA-F10; presentación: spec 004, CA-CAR-02 y CA-CAR-03).
 * Cada operación devuelve el carrito completo, que el padre muestra tal cual (RI-2). Los importes se muestran como llegan de
 * la API: no se suman ni multiplican (RI-1). Mientras una solicitud está en curso, los controles de la línea se bloquean para
 * no cruzar solicitudes (plan R4). Los botones −/+ envían la cantidad ±1 con la misma operación que «Actualizar».
 */
export function LineaCarrito({ linea, alCambiar }: { linea: Linea; alCambiar: (carrito: Carrito) => void }) {
  const [texto, setTexto] = useState(String(linea.cantidad));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sesionCaducada = useSesionCaducada();
  const nombre = linea.nombre ?? "producto";
  const aviso = textoEstadoLinea(linea);
  const noDisponible = linea.estado === "NO_DISPONIBLE";
  // El servidor decide (R4); estos límites solo evitan enviar solicitudes que rechazaría con seguridad.
  const tope = Math.min(MAX_CANTIDAD, linea.disponible);

  async function ejecutar(operacion: () => Promise<Carrito>) {
    if (enviando) return;
    setError(null);
    setEnviando(true);
    try {
      alCambiar(await operacion());
    } catch (err) {
      if (!sesionCaducada(err)) setError(mensajeErrorCarrito(err));
    } finally {
      setEnviando(false);
    }
  }

  function actualizar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = validarCantidad(texto);
    if (!v.ok) return setError(v.mensaje);
    void ejecutar(() => actualizarCantidadCarrito(linea.productoId, v.valor));
  }

  const paso = (delta: 1 | -1) => void ejecutar(() => actualizarCantidadCarrito(linea.productoId, linea.cantidad + delta));

  const quitar = (
    <button
      type="button"
      className={`${claseAccionTexto} text-zinc-600 hover:bg-red-50 hover:text-red-700 dark:text-zinc-300 dark:hover:bg-red-950/40 dark:hover:text-red-300`}
      disabled={enviando}
      onClick={() => void ejecutar(() => quitarDelCarrito(linea.productoId))}
    >
      <IconoPapelera className="h-4 w-4" />
      {/* En pantallas estrechas solo se ve el icono; el nombre accesible sigue siendo «Quitar». */}
      <span className="sr-only sm:not-sr-only">Quitar</span>
    </button>
  );
  const guardando = enviando && (
    <span role="status" className="text-sm text-zinc-500">
      Guardando…
    </span>
  );

  return (
    <li
      data-estado={linea.estado}
      className={`flex gap-3 py-4 sm:gap-4 ${aviso ? "-mx-2 rounded-xl border-l-4 border-amber-500 bg-amber-50 px-2 dark:bg-amber-950/30" : ""}`}
    >
      <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 sm:h-20 sm:w-20 dark:bg-emerald-950/40 dark:text-emerald-400">
        <IconoCanasta className="h-6 w-6 sm:h-8 sm:w-8" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {linea.nombre && <p className="font-medium text-zinc-900 dark:text-zinc-50">{linea.nombre}</p>}
            {linea.precioUnitario && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                <span>{precioTexto(linea.precioUnitario)}</span> / {unidadCorta(linea.unidadVenta ?? "")}
                {linea.presentacion ? ` · ${linea.presentacion}` : ""}
              </p>
            )}
            {aviso && <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{aviso}</p>}
          </div>
          {linea.subtotal && (
            <p data-subtotal-linea className={`shrink-0 text-base font-semibold ${aviso ? "text-zinc-400 line-through" : "text-zinc-900 dark:text-zinc-50"}`}>
              {precioTexto(linea.subtotal)}
            </p>
          )}
        </div>
        {noDisponible ? (
          <div className="flex flex-wrap items-center gap-2">
            {quitar}
            {guardando}
          </div>
        ) : (
          <form onSubmit={actualizar} noValidate className="flex flex-wrap items-center gap-x-1 gap-y-1 sm:gap-x-2">
            <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
              <button type="button" className={claseBotonPaso} aria-label={`Restar uno a ${nombre}`} disabled={enviando || linea.cantidad <= 1} onClick={() => paso(-1)}>
                <IconoMenos className="h-4 w-4" />
              </button>
              <input
                aria-label={`Cantidad de ${nombre}`}
                inputMode="numeric"
                autoComplete="off"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                disabled={enviando}
                className="w-11 border-0 bg-transparent px-1 py-1.5 sm:w-14 text-center text-sm font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 disabled:text-zinc-400 dark:text-zinc-50"
              />
              <button type="button" className={claseBotonPaso} aria-label={`Sumar uno a ${nombre}`} disabled={enviando || linea.cantidad >= tope} onClick={() => paso(1)}>
                <IconoMas className="h-4 w-4" />
              </button>
            </div>
            <button type="submit" className={`${claseAccionTexto} text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40`} disabled={enviando}>
              Actualizar
            </button>
            {quitar}
            {guardando}
          </form>
        )}
        {error && <Aviso tipo="error">{error}</Aviso>}
      </div>
    </li>
  );
}
