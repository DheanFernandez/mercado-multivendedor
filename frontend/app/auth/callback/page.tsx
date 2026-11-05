"use client";

import { useEffect, useState } from "react";
import { Enlace, Mensaje, Pagina } from "@/components/auth/ui";

/**
 * Destino de los enlaces de confirmación de correo e invitación. Supabase ya confirmó la cuenta
 * al abrir el enlace; aquí solo se informa el resultado (los tokens de la URL no se utilizan).
 */
export default function CallbackAuth() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, "") + "&" + window.location.search.replace(/^\?/, ""));
    const descripcion = params.get("error_description");
    void Promise.resolve().then(() => setError(descripcion));
    // Elimina los tokens de la barra de direcciones y del historial.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    <Pagina titulo={error ? "No se pudo confirmar" : "Correo confirmado"} pie={<Enlace href="/login">Ir a iniciar sesión</Enlace>}>
      {error ? (
        <Mensaje tipo="error">{error.replace(/\+/g, " ")}</Mensaje>
      ) : (
        <Mensaje tipo="ok">
          Su correo fue confirmado. Ya puede iniciar sesión. Si un administrador creó su cuenta, use «¿Olvidó su contraseña?» para definir la suya.
        </Mensaje>
      )}
    </Pagina>
  );
}
