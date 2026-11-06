import Link from "next/link";
import { claseBoton } from "@/components/comun";

export default function Inicio() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-zinc-50 to-white px-4 py-20 text-center dark:from-zinc-950 dark:to-black">
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
        Todo el mercado de abastos, en un solo lugar
      </h1>
      <p className="mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
        Descubra productos frescos de distintos puestos, compare precios y conozca de qué puesto proviene cada uno.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/catalogo" className={claseBoton("primario")}>
          Ver catálogo
        </Link>
        <Link href="/registro" className={claseBoton("secundario")}>
          Crear cuenta
        </Link>
      </div>
    </main>
  );
}
