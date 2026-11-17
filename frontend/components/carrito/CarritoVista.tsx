"use client";

import Link from "next/link";
import { type ReactNode, useId, useState } from "react";
import { LineaCarrito } from "@/components/carrito/LineaCarrito";
import { Aviso, Cargando, claseBoton } from "@/components/comun";
import { IconoCanasta, IconoPapelera, IconoTienda } from "@/components/iconos";
import { obtenerCarrito, vaciarCarrito } from "@/lib/api";
import { mensajeErrorCarrito, rotuloPuesto } from "@/lib/carrito";
import { precioTexto } from "@/lib/formato";
import { useCarga } from "@/lib/hooks";
import { useSesionCaducada } from "@/lib/useSesionCaducada";
import type { Carrito, GrupoPuesto } from "@/lib/tipos";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Marco común: ruta de navegación y título «Mi carrito» (spec 004, CA-CAR-01). */
function Marco({ children, subtitulo }: { children: ReactNode; subtitulo?: string }) {
  return (
    <main className="flex-1 bg-white dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <nav aria-label="Ruta de navegación" className="text-sm text-zinc-500 dark:text-zinc-400">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/catalogo" className="hover:text-zinc-900 hover:underline dark:hover:text-zinc-100">
                Catálogo
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" className="font-medium text-zinc-800 dark:text-zinc-200">
              Mi carrito
            </li>
          </ol>
        </nav>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">Mi carrito</h1>
        {subtitulo && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitulo}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

function Grupo({ grupo, alCambiar }: { grupo: GrupoPuesto; alCambiar: (c: Carrito) => void }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-zinc-200/80 bg-white px-4 pt-4 shadow-sm sm:px-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
          <IconoTienda className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 id={id} className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {rotuloPuesto(grupo.puesto)}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{plural(grupo.items.length, "producto", "productos")}</p>
        </div>
      </div>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {grupo.items.map((l) => (
          <LineaCarrito key={`${l.productoId}-${l.cantidad}`} linea={l} alCambiar={alCambiar} />
        ))}
      </ul>
      <p className="border-t border-zinc-100 py-3 text-right text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">Subtotal del puesto: {precioTexto(grupo.subtotal)}</p>
    </section>
  );
}

/** Resumen lateral (spec 004, CA-CAR-01 y CA-CAR-04): importes tal como los entrega la API; sin pedido ni pago (CA-F11). */
function Resumen({ carrito }: { carrito: Carrito }) {
  const lineas = carrito.puestos.reduce((n, g) => n + g.items.length, 0);
  const varios = carrito.puestos.length > 1;
  return (
    <aside aria-label="Resumen del carrito" className="lg:sticky lg:top-20">
      <div className="space-y-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Resumen</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {plural(lineas, "producto", "productos")} · {plural(carrito.puestos.length, "puesto", "puestos")}
          </p>
        </div>
        {varios && (
          <ul aria-label="Subtotales por puesto" className="space-y-2 text-sm">
            {carrito.puestos.map((g) => (
              <li key={g.puesto.id} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <IconoTienda className="h-4 w-4 shrink-0 text-zinc-400" />
                  <span className="truncate">{rotuloPuesto(g.puesto)}</span>
                </span>
                <span className="shrink-0 font-medium text-zinc-900 dark:text-zinc-100">{precioTexto(g.subtotal)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="flex items-baseline justify-between border-t border-zinc-200 pt-4 text-base font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
          Total: <span className="text-2xl font-bold">{precioTexto(carrito.total)}</span>
        </p>
        <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
          Importe estimado: los precios y la disponibilidad se confirman en cada consulta; el pedido y el pago se habilitarán más adelante.
        </p>
        <Link href="/catalogo" className={`${claseBoton("secundario")} w-full rounded-full`}>
          Seguir comprando
        </Link>
      </div>
    </aside>
  );
}

/** Carrito del cliente agrupado por puesto (spec 002-carrito, CA-F2, CA-F3, CA-F9, CA-F11). El estado mostrado es siempre la respuesta de la API (RI-2). */
export function CarritoVista() {
  const carga = useCarga("carrito", obtenerCarrito);
  const [actual, setActual] = useState<Carrito | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [vaciando, setVaciando] = useState(false);
  const [errorVaciar, setErrorVaciar] = useState<string | null>(null);
  const sesionCaducada = useSesionCaducada();
  const carrito = actual ?? carga.datos;

  async function vaciar() {
    if (vaciando) return;
    setVaciando(true);
    setErrorVaciar(null);
    try {
      setActual(await vaciarCarrito());
      setConfirmando(false);
    } catch (err) {
      if (!sesionCaducada(err)) setErrorVaciar(mensajeErrorCarrito(err));
    } finally {
      setVaciando(false);
    }
  }

  if (carga.cargando && !carrito) return <Marco><Cargando /></Marco>;
  if (!carrito) {
    return (
      <Marco>
        <div className="space-y-3">
          <Aviso tipo="error">{carga.error ?? "No se pudo cargar el carrito."}</Aviso>
          <button type="button" className={claseBoton("secundario")} onClick={() => { setActual(null); carga.recargar(); }}>
            Reintentar
          </button>
        </div>
      </Marco>
    );
  }
  if (carrito.puestos.length === 0) {
    return (
      <Marco>
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <span aria-hidden="true" className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
            <IconoCanasta className="h-7 w-7" />
          </span>
          <p className="text-zinc-600 dark:text-zinc-400">Su carrito está vacío.</p>
          <Link href="/catalogo" className={`${claseBoton("primario")} mt-5 rounded-full`}>
            Ver el catálogo
          </Link>
        </div>
      </Marco>
    );
  }
  return (
    <Marco subtitulo="Revise sus productos antes de continuar. Cada puesto prepara su parte.">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          {carrito.requiereRevision && <Aviso tipo="error">Algunos productos requieren revisión: ajuste la cantidad o quítelos para continuar.</Aviso>}
          {carrito.puestos.map((g) => (
            <Grupo key={g.puesto.id} grupo={g} alCambiar={setActual} />
          ))}
          <div className="flex flex-wrap items-center justify-end gap-3">
            {confirmando ? (
              <div role="group" aria-label="Confirmar vaciado" className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">¿Vaciar todo el carrito?</p>
                <button type="button" className={claseBoton("peligro")} disabled={vaciando} onClick={() => void vaciar()}>
                  {vaciando ? "Vaciando…" : "Confirmar"}
                </button>
                <button type="button" className={claseBoton("secundario")} disabled={vaciando} onClick={() => setConfirmando(false)}>
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-red-50 hover:text-red-700 dark:text-zinc-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                onClick={() => setConfirmando(true)}
              >
                <IconoPapelera className="h-4 w-4" />
                Vaciar carrito
              </button>
            )}
          </div>
          {errorVaciar && <Aviso tipo="error">{errorVaciar}</Aviso>}
        </div>
        <Resumen carrito={carrito} />
      </div>
    </Marco>
  );
}
