"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useState } from "react";
import { IconoBolsa, IconoCuadricula, IconoEtiqueta, IconoInicio, IconoPanelLateral, IconoTienda, IconoUsuario, LogoMercado } from "@/components/iconos";
import { obtenerPerfil } from "@/lib/api";
import { alternarPanel, usePanelCategorias } from "@/lib/panelCategorias";
import { supabase } from "@/lib/supabase";
import type { Rol } from "@/lib/tipos";

/** `undefined`: aún se resuelve; `null`: visitante; `{ rol }`: sesión con el rol leído del backend (PostgreSQL). */
type SesionEncabezado = { rol: Rol } | null | undefined;

interface Destino {
  href: string;
  texto: string;
  icono: (p: { className?: string }) => ReactNode;
  /** El carrito del cliente se destaca en el centro de la barra inferior (CA-UI-03). */
  central?: boolean;
}

/**
 * Encabezado y barra inferior móvil (spec 004, E4; CA-UI-02, CA-UI-03). El rol solo decide qué enlaces se muestran: el
 * backend autoriza cada operación. «Carrito» solo aparece para clientes (spec 002, CA-F12).
 */
export function SiteHeader() {
  const sesion = useSesionEncabezado();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-crema-300/70 bg-crema-50/85 font-sans backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-[4.5rem]">
          <Marca />
          <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
            <Suspense fallback={<EnlacesPrincipales sesion={sesion} ruta={null} />}>
              <ConRuta>{(ruta) => <EnlacesPrincipales sesion={sesion} ruta={ruta} />}</ConRuta>
            </Suspense>
          </nav>
        </div>
      </header>
      <Suspense fallback={<BarraInferior sesion={sesion} ruta={null} />}>
        <ConRuta>{(ruta) => <BarraInferior sesion={sesion} ruta={ruta} />}</ConRuta>
      </Suspense>
    </>
  );
}

/**
 * Lee la ruta actual. Con `cacheComponents`, `usePathname` puede suspender al prerenderizar rutas dinámicas: por eso se
 * usa dentro de `<Suspense>`, cuyo fallback muestra los mismos enlaces sin marcar el activo.
 */
function ConRuta({ children }: { children: (ruta: string | null) => ReactNode }) {
  return <>{children(usePathname())}</>;
}

const esActual = (ruta: string | null, href: string) => !!ruta && (href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(`${href}/`));

function useSesionEncabezado(): SesionEncabezado {
  const [sesion, setSesion] = useState<SesionEncabezado>(undefined);
  useEffect(() => {
    let activo = true;
    let cliente: ReturnType<typeof supabase>;
    try {
      cliente = supabase();
    } catch {
      void Promise.resolve().then(() => activo && setSesion(null)); // Supabase sin configurar
      return () => {
        activo = false;
      };
    }
    const resolver = async (hay: boolean) => {
      if (!hay) return activo && setSesion(null);
      try {
        const perfil = await obtenerPerfil();
        if (activo) setSesion({ rol: perfil.rol });
      } catch {
        if (activo) setSesion(null);
      }
    };
    void cliente.auth.getSession().then(({ data }) => resolver(!!data.session));
    const { data } = cliente.auth.onAuthStateChange((_e, s) => void resolver(!!s));
    return () => {
      activo = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return sesion;
}

// ───── Encabezado (escritorio) ─────

const claseEnlace =
  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold text-tinta-suave transition-colors hover:bg-white hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-600 aria-[current=page]:bg-marca-100 aria-[current=page]:text-marca-800";

function EnlacesPrincipales({ sesion, ruta }: { sesion: SesionEncabezado; ruta: string | null }) {
  const enlace = (href: string, texto: ReactNode) => (
    <Link href={href} className={claseEnlace} aria-current={esActual(ruta, href) ? "page" : undefined}>
      {texto}
    </Link>
  );
  return (
    <>
      {/* El logotipo controla el panel de categorías en el catálogo: el inicio tiene su propio enlace (CA-CAT-18). */}
      {enlace("/", "Inicio")}
      {enlace("/catalogo", "Catálogo")}
      {enlace("/ofertas", "Ofertas")}
      {sesion?.rol === "CLIENTE" &&
        enlace(
          "/carrito",
          <>
            <IconoBolsa className="h-4 w-4" />
            Carrito
          </>,
        )}
      {sesion?.rol === "COMERCIANTE" && enlace("/panel/productos", "Mis productos")}
      {sesion?.rol === "ADMINISTRADOR" && (
        <>
          {enlace("/panel", "Administración")}
          {enlace("/panel/productos", "Productos")}
        </>
      )}
      {sesion ? (
        enlace("/cuenta", "Mi cuenta")
      ) : sesion === null ? (
        <>
          {enlace("/login", "Ingresar")}
          <Link
            href="/registro"
            className="ml-1 rounded-full bg-marca-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-marca-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-600 focus-visible:ring-offset-2"
          >
            Crear cuenta
          </Link>
        </>
      ) : null}
    </>
  );
}

// ───── Barra inferior (móvil) ─────

function destinosInferiores(sesion: SesionEncabezado): Destino[] {
  const inicio: Destino = { href: "/", texto: "Inicio", icono: IconoInicio };
  const catalogo: Destino = { href: "/catalogo", texto: "Catálogo", icono: IconoCuadricula };
  const ofertas: Destino = { href: "/ofertas", texto: "Ofertas", icono: IconoEtiqueta };
  const cuenta: Destino = { href: "/cuenta", texto: "Mi cuenta", icono: IconoUsuario };
  if (sesion === undefined) return [inicio, catalogo, ofertas];
  if (sesion === null) return [inicio, catalogo, ofertas, { href: "/login", texto: "Ingresar", icono: IconoUsuario }];
  if (sesion.rol === "CLIENTE") return [inicio, catalogo, { href: "/carrito", texto: "Carrito", icono: IconoBolsa, central: true }, ofertas, cuenta];
  if (sesion.rol === "COMERCIANTE") return [inicio, catalogo, ofertas, { href: "/panel/productos", texto: "Mis productos", icono: IconoTienda }, cuenta];
  if (sesion.rol === "ADMINISTRADOR") return [inicio, catalogo, ofertas, { href: "/panel", texto: "Panel", icono: IconoTienda }, cuenta];
  return [inicio, catalogo, ofertas, cuenta];
}

function BarraInferior({ sesion, ruta }: { sesion: SesionEncabezado; ruta: string | null }) {
  return (
    <nav aria-label="Accesos rápidos" className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 font-sans md:hidden">
      <ul className="flex items-end justify-around rounded-[1.75rem] bg-white/95 px-1.5 pb-2 pt-2 shadow-flotante ring-1 ring-crema-300/80 backdrop-blur-md">
        {destinosInferiores(sesion).map((d) => {
          const actual = esActual(ruta, d.href);
          const Icono = d.icono;
          return (
            <li key={d.href} className="flex min-w-0 flex-1 justify-center">
              {d.central ? (
                <Link href={d.href} aria-current={actual ? "page" : undefined} className="group -mt-7 flex flex-col items-center gap-1 rounded-2xl px-1 focus-visible:outline-none">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-marca-600 text-white shadow-lg ring-4 ring-white transition-colors group-hover:bg-marca-700 group-focus-visible:ring-marca-300">
                    <Icono className="h-6 w-6" />
                  </span>
                  <span className={`text-[0.7rem] font-semibold ${actual ? "text-marca-700" : "text-tinta-suave"}`}>{d.texto}</span>
                </Link>
              ) : (
                <Link
                  href={d.href}
                  aria-current={actual ? "page" : undefined}
                  className="flex min-w-0 flex-col items-center gap-1 rounded-2xl px-2 py-1 text-[0.7rem] font-medium text-tinta-suave transition-colors hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-600 aria-[current=page]:font-bold aria-[current=page]:text-marca-700"
                >
                  <span className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${actual ? "bg-marca-100" : ""}`}>
                    <Icono className="h-[1.3rem] w-[1.3rem]" />
                  </span>
                  <span className="max-w-full truncate">{d.texto}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ───── Marca ─────

/**
 * Logotipo y nombre del mercado (spec 004, E1; CA-CAT-15, CA-CAT-18). Mientras la vista del catálogo tiene su panel
 * montado, la marca es el control que lo oculta o lo muestra (`aria-expanded`, `aria-controls` e indicador). En las demás
 * páginas, y antes de hidratar, es un enlace al inicio. El lema es decorativo (`aria-hidden`).
 */
function Marca() {
  const panel = usePanelCategorias();
  const clases =
    "group -ml-1.5 inline-flex min-w-0 items-center gap-2.5 rounded-2xl py-1 pl-1.5 pr-2.5 text-left text-tinta transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-600";
  const contenido = (
    <>
      <LogoMercado className="h-9 w-9 shrink-0 drop-shadow-sm" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[1.05rem] font-extrabold leading-tight tracking-tight sm:text-lg">Mercado de Abastos</span>
        <span aria-hidden="true" className="hidden truncate text-xs font-medium text-tinta-suave sm:block">
          Productos frescos del mercado
        </span>
      </span>
    </>
  );
  if (!panel.disponible) {
    return (
      <Link href="/" className={clases}>
        {contenido}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={alternarPanel}
      // El nombre empieza por el texto visible (WCAG 2.5.3); con `aria-label` es idéntico en todos los navegadores.
      aria-label="Mercado de Abastos: panel de categorías"
      aria-expanded={panel.expandido}
      aria-controls={panel.idControlado}
      title={panel.expandido ? "Ocultar categorías" : "Mostrar categorías"}
      className={`${clases} hover:bg-white`}
    >
      {contenido}
      <IconoPanelLateral abierto={panel.expandido} className="h-5 w-5 shrink-0 text-tinta-suave transition-colors group-hover:text-marca-700" />
    </button>
  );
}
