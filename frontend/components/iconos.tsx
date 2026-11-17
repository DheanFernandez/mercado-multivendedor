import type { ReactNode } from "react";
import type { ClaveCategoria } from "@/lib/catalogo";

/** Iconos SVG propios (sin dependencias). Son decorativos: `aria-hidden`; el texto accesible lo pone el control que los usa. */
function Svg({ className = "h-5 w-5", children }: { className?: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={className}>
      {children}
    </svg>
  );
}

type P = { className?: string };

export function IconoLupa({ className }: P) {
  return (
    <Svg className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  );
}

/** Logotipo del mercado: hoja sobre un círculo verde oliva (spec 004, E1). */
export function LogoMercado({ className = "h-8 w-8" }: P) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <circle cx="16" cy="16" r="16" className="fill-marca-600" />
      <path d="M9.5 22.5c0-7.4 4.6-12 13-13-.9 8.4-5.6 13-13 13Z" fill="none" stroke="white" strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M9.5 22.5 17 15" fill="none" stroke="white" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  );
}

/** Indicador del panel lateral (CA-CAT-15): la columna izquierda aparece rellena cuando el panel está expandido. */
export function IconoPanelLateral({ className, abierto }: P & { abierto: boolean }) {
  return (
    <Svg className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9 4v16" />
      <rect
        x="4.6"
        y="5.6"
        width="3"
        height="12.8"
        rx="1"
        fill="currentColor"
        stroke="none"
        className={`origin-left transition-[opacity,scale] duration-300 [transform-box:fill-box] motion-reduce:transition-none ${abierto ? "opacity-60" : "scale-x-0 opacity-0"}`}
      />
      <path d={abierto ? "m16 9.5-2.5 2.5 2.5 2.5" : "m13.5 9.5 2.5 2.5-2.5 2.5"} />
    </Svg>
  );
}

// ───── Navegación (spec 004, E4) ─────

export function IconoFiltros({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </Svg>
  );
}

export function IconoInicio({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M3.5 10.5 12 3.8l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19v-8.5Z" />
    </Svg>
  );
}

export function IconoEtiqueta({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.1 7.1a1 1 0 0 1-1.4 0l-8.5-8.1Z" />
      <circle cx="8" cy="8" r="1.5" />
    </Svg>
  );
}

export function IconoBolsa({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M5 8h14l-1 11.2a1.8 1.8 0 0 1-1.8 1.6H7.8A1.8 1.8 0 0 1 6 19.2L5 8Z" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </Svg>
  );
}

export function IconoUsuario({ className }: P) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c.8-3.6 3.8-5.6 7.5-5.6s6.7 2 7.5 5.6" />
    </Svg>
  );
}

export function IconoFlechaDerecha({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

export function IconoVisto({ className }: P) {
  return (
    <Svg className={className}>
      <path d="m5 12.5 4.2 4.2L19 7" />
    </Svg>
  );
}

export function IconoCuadricula({ className }: P) {
  return (
    <Svg className={className}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </Svg>
  );
}

/** Icono decorativo de una categoría (E1-A4). «todas» es la opción «Todos»; «otra», una categoría sin icono propio. */
export function IconoCategoria({ clave, className }: P & { clave: ClaveCategoria | "todas" }) {
  return <Svg className={className}>{TRAZOS_CATEGORIA[clave]}</Svg>;
}

const TRAZOS_CATEGORIA: Record<ClaveCategoria | "todas", ReactNode> = {
  todas: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
  frutas: (
    <>
      <path d="M12 7.5c-1.6-1.3-5.3-1.4-6.6 1.5-1.4 3.1.2 8 2.7 10.3 1.2 1.1 2.6 1.2 3.9.5 1.3.7 2.7.6 3.9-.5 2.5-2.3 4.1-7.2 2.7-10.3-1.3-2.9-5-2.8-6.6-1.5Z" />
      <path d="M12 7.5c0-2 .9-3.4 2.7-4.2" />
    </>
  ),
  verduras: (
    <>
      <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z" />
      <path d="M5 19l8-8M9.5 14.5h3M12 12V9" />
    </>
  ),
  hortalizas: (
    <>
      <path d="M14.8 9.2 4.5 19.5c3.6-.4 8.6-3.4 11-6.6a2.6 2.6 0 0 0-.7-3.7Z" />
      <path d="M15 9c-.2-2.2.6-4.2 2.4-5.4M15 9c2.2.2 4.2-.6 5.4-2.4M15 9l3.5-3.5M8.5 15.5l1.5 1.5M11 13l1.5 1.5" />
    </>
  ),
  tuberculos: (
    <>
      <path d="M6.4 17.1c-2.6-2.4-2.2-6.9 1.2-9.5 3.5-2.7 8.6-2.8 10.6.2 2 3 .8 8-2.6 10.1-3.2 2-7 1.3-9.2-.8Z" />
      <path d="M10 10.5h.01M14.5 9.5h.01M13 14.5h.01M9 14h.01" />
    </>
  ),
  abarrotes: (
    <>
      <path d="M8 7h8l2 3v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-9l2-3Z" />
      <path d="M8 7l1-3h6l1 3M9.5 14h5" />
    </>
  ),
  lacteos: (
    <>
      <path d="M8 8.5 10 4h4l2 4.5V19a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8.5Z" />
      <path d="M8 8.5h8M10.5 13.5h3" />
    </>
  ),
  carnes: (
    <>
      <path d="M4.5 13c0-4.7 3.8-8 8.5-8 4.2 0 6.8 2.7 6.8 6.1 0 4.6-4 8.4-9.3 8.4-3.6 0-6-2.6-6-6.5Z" />
      <circle cx="13.5" cy="11" r="2" />
    </>
  ),
  pescados: (
    <>
      <path d="M16.5 12c-2-3-5-5-8.5-5S3 9.5 2.5 12C3 14.5 4.5 17 8 17s6.5-2 8.5-5Z" />
      <path d="M16.5 12 21 8v8l-4.5-4ZM6.5 11h.01" />
    </>
  ),
  panaderia: (
    <>
      <path d="M5.5 10.5A3 3 0 0 1 6.4 5C8 4.2 10 3.8 12 3.8s4 .4 5.6 1.2a3 3 0 0 1 .9 5.5V19a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-8.5Z" />
      <path d="M9.5 9v3M12 8.5v3.5M14.5 9v3" />
    </>
  ),
  huevos: <path d="M12 3c3.6 0 6.5 5.6 6.5 10.2a6.5 6.5 0 0 1-13 0C5.5 8.6 8.4 3 12 3Z" />,
  granos: (
    <path d="M12 21V7M12 11c-2.5 0-4-1.5-4.5-4 2.5 0 4 1.5 4.5 4Zm0 0c2.5 0 4-1.5 4.5-4-2.5 0-4 1.5-4.5 4Zm0 5c-2.5 0-4-1.5-4.5-4 2.5 0 4 1.5 4.5 4Zm0 0c2.5 0 4-1.5 4.5-4-2.5 0-4 1.5-4.5 4ZM12 7c-1-1-1-3 0-4 1 1 1 3 0 4Z" />
  ),
  otra: (
    <>
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.1 7.1a1 1 0 0 1-1.4 0l-8.5-8.1Z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
};

export function IconoCerrar({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  );
}

export function IconoTienda({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9" />
      <path d="M3 10 5 4h14l2 6c0 1.4-1.3 2.5-3 2.5S15 11.4 15 10c0 1.4-1.3 2.5-3 2.5S9 11.4 9 10c0 1.4-1.3 2.5-3 2.5S3 11.4 3 10Z" />
      <path d="M10 20v-4h4v4" />
    </Svg>
  );
}

export function IconoCanasta({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M5 10h14l-1.4 8.4A2 2 0 0 1 15.6 20H8.4a2 2 0 0 1-2-1.6L5 10Z" />
      <path d="M3 10h18M8 10l3-6M16 10l-3-6M10 14v3M14 14v3" />
    </Svg>
  );
}

export function IconoAlerta({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4M12 17h0" />
    </Svg>
  );
}

export function IconoSinConexion({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M2 8.8a16 16 0 0 1 4.2-2.6M9.7 5.2A16 16 0 0 1 22 8.8M5 12.5a11 11 0 0 1 4-2.2M15 10.6a11 11 0 0 1 4 1.9M8.5 16a6 6 0 0 1 7 0M12 20h0M3 3l18 18" />
    </Svg>
  );
}

export function IconoRecargar({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </Svg>
  );
}

export function IconoMas({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconoMenos({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M5 12h14" />
    </Svg>
  );
}

export function IconoPapelera({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </Svg>
  );
}

export function IconoFlechaIzquierda({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M15 18l-6-6 6-6" />
    </Svg>
  );
}

export function IconoImagen({ className }: P) {
  return (
    <Svg className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 16-5-5-9 9" />
    </Svg>
  );
}
