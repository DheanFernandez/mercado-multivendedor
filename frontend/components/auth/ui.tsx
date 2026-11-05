import Link from "next/link";
import type { ReactNode } from "react";

export function Pagina({ titulo, children, pie }: { titulo: string; children: ReactNode; pie?: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow dark:bg-zinc-900">
        <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{titulo}</h1>
        {children}
        {pie && <div className="mt-6 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">{pie}</div>}
      </div>
    </main>
  );
}

export function Campo(props: React.InputHTMLAttributes<HTMLInputElement> & { etiqueta: string }) {
  const { etiqueta, id, ...resto } = props;
  const campo = id ?? props.name;
  return (
    <label htmlFor={campo} className="mb-4 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
      {etiqueta}
      <input
        id={campo}
        {...resto}
        className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
      />
    </label>
  );
}

export function Boton({ cargando, children, ...resto }: React.ButtonHTMLAttributes<HTMLButtonElement> & { cargando?: boolean }) {
  return (
    <button
      {...resto}
      disabled={cargando || resto.disabled}
      className="w-full rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {cargando ? "Procesando…" : children}
    </button>
  );
}

export function Mensaje({ tipo, children }: { tipo: "error" | "ok"; children: ReactNode }) {
  const color = tipo === "error" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800";
  return (
    <p role={tipo === "error" ? "alert" : "status"} className={`mb-4 rounded-md px-3 py-2 text-sm ${color}`}>
      {children}
    </p>
  );
}

export const Enlace = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className="font-medium text-zinc-900 underline dark:text-zinc-100">
    {children}
  </Link>
);
