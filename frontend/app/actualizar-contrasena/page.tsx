"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { Boton, Campo, Enlace, Mensaje, Pagina } from "@/components/auth/ui";
import { mensajeDeError, supabase } from "@/lib/supabase";

/** Destino del enlace de recuperación: el cliente intercambia el código del enlace por una sesión temporal. */
export default function ActualizarContrasena() {
  const router = useRouter();
  const [sesion, setSesion] = useState<"cargando" | "lista" | "invalida">("cargando");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const cliente = supabase();
    const { data } = cliente.auth.onAuthStateChange((evento, s) => {
      if (s && (evento === "PASSWORD_RECOVERY" || evento === "SIGNED_IN" || evento === "INITIAL_SESSION")) setSesion("lista");
    });
    // Si tras unos segundos no hay sesión, el enlace es inválido o expiró.
    const t = setTimeout(async () => {
      const { data: s } = await cliente.auth.getSession();
      setSesion(s.session ? "lista" : "invalida");
    }, 4000);
    return () => {
      data.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const nueva = String(d.get("contrasena"));
    if (nueva.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (nueva !== String(d.get("confirmar"))) return setError("Las contraseñas no coinciden.");
    setCargando(true);
    setError(null);
    try {
      const { error } = await supabase().auth.updateUser({ password: nueva });
      if (error) setError(mensajeDeError(error));
      else router.replace("/cuenta");
    } catch {
      setError("No se pudo completar la operación. Inténtelo de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  if (sesion === "invalida") {
    return (
      <Pagina titulo="Enlace no válido" pie={<Enlace href="/recuperar-contrasena">Solicitar un enlace nuevo</Enlace>}>
        <Mensaje tipo="error">El enlace de recuperación no es válido o ya expiró.</Mensaje>
      </Pagina>
    );
  }

  return (
    <Pagina titulo="Nueva contraseña">
      {sesion === "cargando" ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Verificando enlace…</p>
      ) : (
        <form onSubmit={enviar} noValidate>
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <Campo etiqueta="Nueva contraseña (mínimo 8 caracteres)" name="contrasena" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
          <Campo etiqueta="Confirmar contraseña" name="confirmar" type="password" autoComplete="new-password" required />
          <Boton type="submit" cargando={cargando}>Guardar contraseña</Boton>
        </form>
      )}
    </Pagina>
  );
}
