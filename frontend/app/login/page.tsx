"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Boton, Campo, Enlace, Mensaje, Pagina } from "@/components/auth/ui";
import { mensajeDeError, supabase } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setCargando(true);
    setError(null);
    try {
      const { error } = await supabase().auth.signInWithPassword({
        email: String(datos.get("email")).trim(),
        password: String(datos.get("contrasena")),
      });
      if (error) setError(mensajeDeError(error));
      else router.replace("/cuenta");
    } catch {
      setError("No se pudo completar la operación. Inténtelo de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <Pagina
      titulo="Iniciar sesión"
      pie={
        <>
          <p><Enlace href="/recuperar-contrasena">¿Olvidó su contraseña?</Enlace></p>
          <p>¿No tiene cuenta? <Enlace href="/registro">Regístrese</Enlace></p>
        </>
      }
    >
      <form onSubmit={enviar} noValidate>
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        <Campo etiqueta="Correo electrónico" name="email" type="email" autoComplete="email" required />
        <Campo etiqueta="Contraseña" name="contrasena" type="password" autoComplete="current-password" required />
        <Boton type="submit" cargando={cargando}>Entrar</Boton>
      </form>
    </Pagina>
  );
}
