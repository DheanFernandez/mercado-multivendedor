"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ErrorApi, obtenerPerfil } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Perfil } from "@/lib/tipos";

export const mensajeError = (e: unknown) => (e instanceof ErrorApi ? e.message : "No se pudo completar la operación.");

/**
 * Carga datos asíncronos. Se vuelve a ejecutar cuando cambia `clave` o se llama a `recargar()`.
 * `cargando` es verdadero mientras los datos no correspondan a la clave actual.
 */
export function useCarga<T>(clave: string, cargar: () => Promise<T>) {
  const [version, setVersion] = useState(0);
  const [estado, setEstado] = useState<{ id: string; datos?: T; error?: string }>({ id: "" });
  const ultima = useRef(cargar);
  useEffect(() => {
    ultima.current = cargar;
  });
  const id = `${clave}#${version}`;
  useEffect(() => {
    let activo = true;
    ultima.current().then(
      (datos) => activo && setEstado({ id, datos }),
      (e) => activo && setEstado({ id, error: mensajeError(e) }),
    );
    return () => {
      activo = false;
    };
  }, [id]);
  const actual = estado.id === id;
  return {
    datos: actual ? estado.datos : undefined,
    error: actual ? estado.error : undefined,
    cargando: !actual,
    recargar: () => setVersion((v) => v + 1),
  };
}

export type Acceso =
  | { estado: "cargando" }
  | { estado: "denegado"; perfil: Perfil }
  | { estado: "error"; mensaje: string }
  | { estado: "listo"; perfil: Perfil };

/**
 * Sesión + perfil (rol leído por el backend desde PostgreSQL). Redirige al login si no hay sesión.
 * Es solo experiencia de usuario: el backend vuelve a verificar cada operación.
 */
export function useAcceso(rolesPermitidos: Perfil["rol"][]): Acceso {
  const router = useRouter();
  const [acceso, setAcceso] = useState<Acceso>({ estado: "cargando" });
  const clave = rolesPermitidos.join(",");
  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const { data } = await supabase().auth.getSession();
        if (!data.session) return router.replace("/login");
        const perfil = await obtenerPerfil();
        if (!activo) return;
        setAcceso(clave.split(",").includes(perfil.rol) ? { estado: "listo", perfil } : { estado: "denegado", perfil });
      } catch (e) {
        if (e instanceof ErrorApi && e.estado === 401) {
          await supabase().auth.signOut();
          return router.replace("/login");
        }
        if (activo) setAcceso({ estado: "error", mensaje: mensajeError(e) });
      }
    })();
    return () => {
      activo = false;
    };
  }, [clave, router]);
  return acceso;
}
