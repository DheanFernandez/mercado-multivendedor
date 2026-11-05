"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Boton, Mensaje, Pagina } from "@/components/auth/ui";
import { ErrorApi, obtenerPerfil, type Perfil } from "@/lib/api";
import { supabase } from "@/lib/supabase";

/**
 * Página protegida. La verificación real la hace el backend (JWT + rol en PostgreSQL);
 * aquí solo se redirige al login cuando no hay sesión válida y se muestra el perfil recibido.
 */
export default function Cuenta() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    const cliente = supabase();

    async function cargar() {
      const { data } = await cliente.auth.getSession();
      if (!data.session) return router.replace("/login");
      try {
        const p = await obtenerPerfil();
        if (activo) setPerfil(p);
      } catch (err) {
        if (!(err instanceof ErrorApi)) return setError("No se pudo cargar su perfil.");
        if (err.estado === 401) {
          await cliente.auth.signOut(); // sesión expirada o revocada
          return router.replace("/login");
        }
        if (activo) setError(err.estado === 403 ? err.message : "No se pudo cargar su perfil.");
      }
    }
    void cargar();

    const { data: sub } = cliente.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") router.replace("/login");
    });
    return () => {
      activo = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  async function salir() {
    await supabase().auth.signOut();
    router.replace("/login");
  }

  return (
    <Pagina titulo="Mi cuenta">
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!perfil && !error && <p className="text-sm text-zinc-600 dark:text-zinc-400">Cargando…</p>}
      {perfil && (
        <dl className="mb-6 space-y-2 text-sm text-zinc-800 dark:text-zinc-200">
          <div><dt className="font-medium">Nombre</dt><dd>{perfil.nombres} {perfil.apellidos}</dd></div>
          <div><dt className="font-medium">Correo</dt><dd>{perfil.email}</dd></div>
          <div><dt className="font-medium">Rol</dt><dd>{perfil.rol}</dd></div>
        </dl>
      )}
      <Boton type="button" onClick={salir}>Cerrar sesión</Boton>
    </Pagina>
  );
}
