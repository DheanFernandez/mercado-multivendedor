"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { esSesionCaducada } from "@/lib/carrito";
import { supabase } from "@/lib/supabase";

/**
 * Spec 002-carrito, CA-F7: ante un 401 se cierra la sesión local y se redirige al ingreso.
 * Devuelve una función que, para un error de sesión caducada, hace eso y responde `true` (ya está tratado).
 */
export function useSesionCaducada() {
  const router = useRouter();
  return useCallback(
    (e: unknown): boolean => {
      if (!esSesionCaducada(e)) return false;
      void Promise.resolve(supabase().auth.signOut()).finally(() => router.replace("/login"));
      return true;
    },
    [router],
  );
}
