"use client";

import { type ReactNode, useId } from "react";
import { IconoCategoria, IconoRecargar } from "@/components/iconos";
import { TONOS } from "@/components/tienda/tonos";
import { type ClaveCategoria, claveCategoria } from "@/lib/catalogo";
import type { Categoria } from "@/lib/tipos";

type Puesto = { id: string; codigo: string; nombre: string };

/** Estado de una carga auxiliar (`useCarga`): datos, error o en curso. */
interface Carga<T> {
  datos?: T;
  error?: string;
  cargando: boolean;
  recargar: () => void;
}

const claseRotulo = "px-3 text-[0.7rem] font-extrabold uppercase tracking-[0.16em] text-tinta-suave";

/**
 * Panel de categorías del catálogo (spec 004, enmienda E1; CA-CAT-13, CA-CAT-14, E1-A3). Muestra «Todos» y las categorías
 * que devuelve la API, sin una lista fija. Elegir una aplica el filtro al instante (sin «Aplicar»). Debajo, el filtro por
 * puesto (RF18). Se usa en la barra lateral (escritorio) y en el diálogo superpuesto (móvil).
 */
export function PanelCategorias({
  idTitulo,
  mostrarTitulo = true,
  categorias,
  categoriaId,
  alElegirCategoria,
  puestos,
  puestoId,
  alElegirPuesto,
}: {
  idTitulo?: string;
  mostrarTitulo?: boolean;
  categorias: Carga<Categoria[]>;
  categoriaId?: string;
  alElegirCategoria: (id: string | undefined) => void;
  puestos: Carga<Puesto[]>;
  puestoId?: string;
  alElegirPuesto: (id: string | undefined) => void;
}) {
  const idPuesto = useId();
  const lista = categorias.datos;

  return (
    <div className="space-y-8">
      <div>
        {mostrarTitulo && (
          <h2 id={idTitulo} className={claseRotulo}>
            Categorías
          </h2>
        )}
        <ul className={`space-y-0.5 ${mostrarTitulo ? "mt-3" : ""}`}>
          <li>
            <BotonCategoria clave="todas" activa={!categoriaId} alPulsar={() => alElegirCategoria(undefined)}>
              Todos
            </BotonCategoria>
          </li>
          {lista?.map((c) => (
            <li key={c.id}>
              <BotonCategoria clave={claveCategoria(c.slug, c.nombre)} activa={categoriaId === c.id} alPulsar={() => alElegirCategoria(c.id)}>
                {c.nombre}
              </BotonCategoria>
            </li>
          ))}
        </ul>

        {categorias.error ? (
          <div role="alert" className="mx-3 mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <p>No se pudieron cargar las categorías.</p>
            <button type="button" onClick={categorias.recargar} className="mt-1.5 inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline">
              <IconoRecargar className="h-3.5 w-3.5" />
              Reintentar
            </button>
          </div>
        ) : !lista ? (
          <div role="status" className="mt-1 space-y-0.5">
            <span className="sr-only">Cargando categorías…</span>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} aria-hidden="true" className="flex animate-pulse items-center gap-3 px-3 py-2">
                <span className="h-9 w-9 rounded-full bg-crema-200" />
                <span className="h-3 rounded bg-crema-200" style={{ width: `${45 + ((i * 17) % 35)}%` }} />
              </div>
            ))}
          </div>
        ) : lista.length === 0 ? (
          <p className="mt-3 px-3 text-sm text-tinta-suave">Aún no hay categorías registradas.</p>
        ) : null}
      </div>

      {/* Filtro por puesto (RF18, E1-A3). Si la lista no está disponible, el catálogo sigue funcionando sin esta opción. */}
      {(puestos.cargando || (puestos.datos && puestos.datos.length > 0)) && (
        <div>
          <label htmlFor={idPuesto} className={`${claseRotulo} block`}>
            Puesto
          </label>
          <div className="mt-3 px-3">
            <select
              id={idPuesto}
              value={puestoId ?? ""}
              disabled={!puestos.datos}
              onChange={(e) => alElegirPuesto(e.target.value || undefined)}
              className="w-full rounded-xl border border-crema-300 bg-white px-3 py-2.5 text-sm font-medium text-tinta transition-colors hover:border-crema-400 focus:border-marca-600 focus:outline-none focus:ring-2 focus:ring-marca-600/20 disabled:text-tinta-suave"
            >
              <option value="">{puestos.datos ? "Todos los puestos" : "Cargando puestos…"}</option>
              {puestos.datos?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo} · {p.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function BotonCategoria({ clave, activa, alPulsar, children }: { clave: ClaveCategoria | "todas"; activa: boolean; alPulsar: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={alPulsar}
      className={`group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left text-[0.92rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-600 ${
        activa ? "bg-marca-100 font-bold text-marca-800" : "font-medium text-tinta hover:bg-crema-100"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${activa ? "bg-marca-600 text-white" : `${TONOS[clave].fondo} ${TONOS[clave].icono}`}`}
      >
        <IconoCategoria clave={clave} className="h-[1.05rem] w-[1.05rem]" />
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}
