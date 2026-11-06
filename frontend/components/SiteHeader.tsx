"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { obtenerPerfil } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Rol } from "@/lib/tipos";

/** Navegación principal. El rol se obtiene del backend (PostgreSQL); aquí solo decide qué enlaces mostrar. */
export function SiteHeader() {
  const [sesion, setSesion] = useState<{ rol: Rol } | null | undefined>(undefined);

  useEffect(() => {
    let activo = true;
    let cliente: ReturnType<typeof supabase>;
    try {
      cliente = supabase();
    } catch {
      void Promise.resolve().then(() => activo && setSesion(null)); // Supabase sin configurar
      return () => {
        activo = false;
      };
    }
    const resolver = async (hay: boolean) => {
      if (!hay) return activo && setSesion(null);
      try {
        const perfil = await obtenerPerfil();
        if (activo) setSesion({ rol: perfil.rol });
      } catch {
        if (activo) setSesion(null);
      }
    };
    void cliente.auth.getSession().then(({ data }) => resolver(!!data.session));
    const { data } = cliente.auth.onAuthStateChange((_e, s) => void resolver(!!s));
    return () => {
      activo = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const enlace = "rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link href="/" className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Mercado de Abastos
        </Link>
        <nav aria-label="Principal" className="flex flex-wrap items-center gap-1">
          <Link href="/catalogo" className={enlace}>Catálogo</Link>
          {sesion?.rol === "COMERCIANTE" && <Link href="/panel/productos" className={enlace}>Mis productos</Link>}
          {sesion?.rol === "ADMINISTRADOR" && (
            <>
              <Link href="/panel" className={enlace}>Administración</Link>
              <Link href="/panel/productos" className={enlace}>Productos</Link>
            </>
          )}
          {sesion ? (
            <Link href="/cuenta" className={enlace}>Mi cuenta</Link>
          ) : sesion === null ? (
            <>
              <Link href="/login" className={enlace}>Ingresar</Link>
              <Link href="/registro" className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">
                Crear cuenta
              </Link>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
