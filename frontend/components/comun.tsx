import type { ReactNode } from "react";
import { ETIQUETA_ESTADO } from "@/lib/formato";

export function Contenedor({ titulo, acciones, children }: { titulo: string; acciones?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{titulo}</h1>
        {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
      </div>
      {children}
    </main>
  );
}

export const clasesCampo =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50";

export function Seleccion({ etiqueta, children, ...resto }: React.SelectHTMLAttributes<HTMLSelectElement> & { etiqueta: string }) {
  return (
    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
      {etiqueta}
      <select {...resto} className={clasesCampo}>
        {children}
      </select>
    </label>
  );
}

export function Entrada({ etiqueta, ...resto }: React.InputHTMLAttributes<HTMLInputElement> & { etiqueta: string }) {
  return (
    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
      {etiqueta}
      <input {...resto} className={clasesCampo} />
    </label>
  );
}

export const claseBoton = (variante: "primario" | "secundario" | "peligro" = "primario") =>
  `inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
    variante === "primario"
      ? "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      : variante === "peligro"
        ? "bg-red-600 text-white hover:bg-red-700"
        : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
  }`;

export function Insignia({ estado }: { estado: string }) {
  const e = ETIQUETA_ESTADO[estado] ?? { texto: estado, clases: "bg-zinc-100 text-zinc-700" };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${e.clases}`}>{e.texto}</span>;
}

export function Aviso({ tipo, children }: { tipo: "error" | "ok" | "info"; children: ReactNode }) {
  const color = tipo === "error" ? "bg-red-50 text-red-800" : tipo === "ok" ? "bg-green-50 text-green-800" : "bg-zinc-100 text-zinc-700";
  return (
    <p role={tipo === "error" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-sm ${color}`}>
      {children}
    </p>
  );
}

export const Cargando = ({ texto = "Cargando…" }: { texto?: string }) => (
  <p className="py-8 text-center text-sm text-zinc-500" role="status">
    {texto}
  </p>
);

export function Paginacion({ pagina, totalPaginas, alCambiar }: { pagina: number; totalPaginas: number; alCambiar: (p: number) => void }) {
  if (totalPaginas <= 1) return null;
  return (
    <nav aria-label="Paginación" className="mt-8 flex items-center justify-center gap-3 text-sm">
      <button type="button" className={claseBoton("secundario")} disabled={pagina <= 1} onClick={() => alCambiar(pagina - 1)}>
        Anterior
      </button>
      <span className="text-zinc-600 dark:text-zinc-400">
        Página {pagina} de {totalPaginas}
      </span>
      <button type="button" className={claseBoton("secundario")} disabled={pagina >= totalPaginas} onClick={() => alCambiar(pagina + 1)}>
        Siguiente
      </button>
    </nav>
  );
}

/** Las listas de administración no devuelven total: si la página llega llena se asume que existe una siguiente. */
export const totalPaginasEstimado = (pagina: number, recibidos: number, limite: number) => (recibidos >= limite ? pagina + 1 : pagina);
