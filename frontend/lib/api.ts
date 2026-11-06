"use client";

import { supabase } from "@/lib/supabase";

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

const base = () => (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");

async function peticion<T>(ruta: string, init: RequestInit = {}, conSesion = false): Promise<T> {
  const cabeceras = new Headers(init.headers);
  cabeceras.set("Content-Type", "application/json");
  if (conSesion) {
    const { data } = await supabase().auth.getSession();
    if (data.session) cabeceras.set("Authorization", `Bearer ${data.session.access_token}`);
  }
  let res: Response;
  try {
    res = await fetch(`${base()}${ruta}`, { ...init, headers: cabeceras });
  } catch {
    throw new ErrorApi(0, "No se pudo conectar con el servidor.");
  }
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) throw new ErrorApi(res.status, typeof cuerpo?.mensaje === "string" ? cuerpo.mensaje : "Error inesperado.");
  return cuerpo as T;
}

export interface Perfil {
  id: string;
  email: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  rol: "CLIENTE" | "COMERCIANTE" | "TRABAJADOR_PUESTO" | "ADMINISTRADOR";
  estado: string;
}

/** Autorregistro: el rol lo fija el servidor (siempre CLIENTE); aquí no se envía. */
export const registrarCliente = (datos: {
  email: string;
  contrasena: string;
  nombres: string;
  apellidos: string;
  telefono?: string;
}) => peticion<Perfil>("/api/v1/auth/registro", { method: "POST", body: JSON.stringify(datos) });

/** Perfil y rol del usuario, leídos por el servidor desde PostgreSQL. Solo para mostrar; no es una barrera de seguridad. */
export const obtenerPerfil = () => peticion<Perfil>("/api/v1/auth/me", {}, true);
