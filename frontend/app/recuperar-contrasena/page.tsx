"use client";

import { type FormEvent, useState } from "react";
import { Boton, Campo, Enlace, Mensaje, Pagina } from "@/components/auth/ui";
import { mensajeDeError, supabase } from "@/lib/supabase";

export default function RecuperarContrasena() {
  const [estado, setEstado] = useState<{ tipo: "error" | "ok"; texto: string } | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    setCargando(true);
    setEstado(null);
    try {
      const { error } = await supabase().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/actualizar-contrasena`,
      });
      // Mensaje neutro: no revela si el correo está registrado.
      if (error && (error.status === 429 || error.code?.startsWith("over_"))) setEstado({ tipo: "error", texto: mensajeDeError(error) });
      else setEstado({ tipo: "ok", texto: "Si el correo está registrado, recibirá un enlace para restablecer su contraseña." });
    } catch {
      setEstado({ tipo: "error", texto: "No se pudo completar la operación. Inténtelo de nuevo." });
    } finally {
      setCargando(false);
    }
  }

  return (
    <Pagina titulo="Recuperar contraseña" pie={<Enlace href="/login">Volver a iniciar sesión</Enlace>}>
      <form onSubmit={enviar} noValidate>
        {estado && <Mensaje tipo={estado.tipo}>{estado.texto}</Mensaje>}
        <Campo etiqueta="Correo electrónico" name="email" type="email" autoComplete="email" required />
        <Boton type="submit" cargando={cargando}>Enviar enlace</Boton>
      </form>
    </Pagina>
  );
}
