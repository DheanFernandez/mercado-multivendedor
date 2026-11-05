"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | undefined;

/**
 * Cliente de Supabase para el navegador. Usa SOLO la clave pública (publishable/anon).
 * La clave de servicio (service role) nunca debe existir en el frontend.
 * Se crea de forma perezosa para que el build no requiera variables de entorno.
 */
export function supabase(): SupabaseClient {
  if (!cliente) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !clave) {
      throw new Error(
        "Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (ver frontend/.env.example).",
      );
    }
    cliente = createBrowserClient(url, clave);
  }
  return cliente;
}

/** Traduce los errores de Supabase Auth a mensajes para el usuario, sin revelar si un correo existe. */
export function mensajeDeError(error: { code?: string; message?: string; status?: number }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Correo o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Debe confirmar su correo electrónico antes de iniciar sesión.";
    case "weak_password":
      return "La contraseña es demasiado débil.";
    case "same_password":
      return "La nueva contraseña debe ser distinta de la anterior.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Demasiados intentos. Espere unos minutos e inténtelo de nuevo.";
    case "user_banned":
      return "Su cuenta no está habilitada.";
    default:
      return error.status === 429
        ? "Demasiados intentos. Espere unos minutos e inténtelo de nuevo."
        : "No se pudo completar la operación. Inténtelo de nuevo.";
  }
}
