"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { IconoAlerta, IconoCerrar, IconoMas, IconoVisto } from "@/components/iconos";
import { agregarAlCarrito } from "@/lib/api";
import { mensajeErrorCarrito } from "@/lib/carrito";
import { type Sesion, useSesion } from "@/lib/hooks";
import type { ProductoCatalogo } from "@/lib/tipos";
import { useSesionCaducada } from "@/lib/useSesionCaducada";

export interface AvisoCarrito {
  id: number;
  tipo: "ok" | "error";
  texto: string;
}

/**
 * Agregar al carrito desde las tarjetas (spec 004, E4; CA-UI-07). Una sesión por vista (no una por tarjeta). Envía
 * `cantidad = 1` con la API existente del carrito (spec 002); el servidor decide stock y permisos. Un 401 cierra la sesión
 * y lleva al ingreso (CA-F7).
 */
export function useAgregarAlCarrito() {
  const sesion = useSesion();
  const sesionCaducada = useSesionCaducada();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<AvisoCarrito | null>(null);

  async function agregar(p: ProductoCatalogo) {
    if (enviando) return;
    setEnviando(p.id);
    try {
      await agregarAlCarrito(p.id, 1);
      setAviso({ id: Date.now(), tipo: "ok", texto: `${p.nombre} agregado al carrito` });
    } catch (e) {
      if (!sesionCaducada(e)) setAviso({ id: Date.now(), tipo: "error", texto: mensajeErrorCarrito(e) });
    } finally {
      setEnviando(null);
    }
  }

  const cerrarAviso = useCallback(() => setAviso(null), []);
  return { sesion, agregar, enviando, aviso, cerrarAviso };
}

const claseCirculo =
  "flex h-10 w-10 items-center justify-center rounded-full bg-marca-600 text-white shadow-md ring-4 ring-white transition hover:scale-105 hover:bg-marca-700 focus-visible:outline-none focus-visible:ring-marca-300 disabled:cursor-not-allowed disabled:opacity-60";

/** Acción circular de la tarjeta según la sesión: cliente → agregar; visitante → ingresar; otros roles → nada. */
export function BotonAgregar({ producto, sesion, enviando, alAgregar }: { producto: ProductoCatalogo; sesion: Sesion; enviando: string | null; alAgregar: (p: ProductoCatalogo) => void }) {
  if (sesion.estado === "visitante") {
    return (
      <Link href="/login" aria-label={`Ingresar para agregar ${producto.nombre} al carrito`} title="Ingresar para comprar" className={claseCirculo}>
        <IconoMas className="h-5 w-5" />
      </Link>
    );
  }
  if (sesion.estado !== "cliente") return null; // cargando u otros roles (spec 002, CA-F8)
  const esteEnvia = enviando === producto.id;
  return (
    <button
      type="button"
      onClick={() => alAgregar(producto)}
      disabled={enviando !== null}
      aria-busy={esteEnvia}
      aria-label={`Agregar ${producto.nombre} al carrito`}
      title="Agregar al carrito"
      className={claseCirculo}
    >
      {esteEnvia ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <IconoMas className="h-5 w-5" />}
    </button>
  );
}

/**
 * Aviso flotante del carrito: encima de la barra inferior en móvil y abajo a la derecha en escritorio. El de éxito se
 * cierra solo a los 5 s; el de error permanece hasta cerrarlo.
 */
export function AvisoFlotanteCarrito({ aviso, alCerrar }: { aviso: AvisoCarrito | null; alCerrar: () => void }) {
  useEffect(() => {
    if (aviso?.tipo !== "ok") return;
    const t = setTimeout(alCerrar, 5000);
    return () => clearTimeout(t);
  }, [aviso, alCerrar]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] z-40 flex justify-center md:inset-x-auto md:bottom-6 md:right-6">
      {aviso && (
        <div
          key={aviso.id}
          role={aviso.tipo === "ok" ? "status" : "alert"}
          className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-flotante ring-1 transition duration-300 starting:translate-y-2 starting:opacity-0 ${
            aviso.tipo === "ok" ? "bg-tinta text-white ring-black/10" : "bg-white text-red-800 ring-red-200"
          }`}
        >
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${aviso.tipo === "ok" ? "bg-marca-500 text-white" : "bg-red-50 text-red-700"}`}>
            {aviso.tipo === "ok" ? <IconoVisto className="h-4 w-4" /> : <IconoAlerta className="h-4 w-4" />}
          </span>
          <p className="min-w-0 flex-1 font-medium">{aviso.texto}</p>
          {aviso.tipo === "ok" && (
            <Link href="/carrito" className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold transition hover:bg-white/25">
              Ver carrito
            </Link>
          )}
          <button type="button" onClick={alCerrar} aria-label="Cerrar aviso" className="shrink-0 rounded-full p-1.5 opacity-70 transition hover:opacity-100">
            <IconoCerrar className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
