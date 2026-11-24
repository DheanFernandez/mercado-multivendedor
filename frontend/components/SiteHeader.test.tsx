import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ getSession: vi.fn(), obtenerPerfil: vi.fn(), obtenerCarrito: vi.fn(), ruta: { actual: "/" } }));
vi.mock("@/lib/supabase", () => ({
  supabase: () => ({ auth: { getSession: m.getSession, onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) } }),
}));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), obtenerPerfil: m.obtenerPerfil, obtenerCarrito: m.obtenerCarrito }));
vi.mock("next/navigation", () => ({ usePathname: () => m.ruta.actual }));

import { SiteHeader } from "@/components/SiteHeader";
import { ID_PANEL_LATERAL, ID_PANEL_MOVIL, reiniciarPanelCategorias, usePanelCategorias, useRegistrarPanel } from "@/lib/panelCategorias";

beforeEach(() => {
  [m.getSession, m.obtenerPerfil, m.obtenerCarrito].forEach((f) => f.mockReset());
  m.ruta.actual = "/";
});

/** El encabezado (escritorio) y la barra inferior (móvil) coexisten en el DOM; el CSS muestra uno u otro según el ancho. */
const principal = () => within(screen.getByRole("navigation", { name: "Principal" }));
const inferior = () => within(screen.getByRole("navigation", { name: "Accesos rápidos" }));
const textos = (nav: { getAllByRole: (rol: "link") => HTMLElement[] }) => nav.getAllByRole("link").map((a) => a.textContent);

function conSesion(rol: string | null) {
  if (rol === null) return m.getSession.mockResolvedValue({ data: { session: null } });
  m.getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
  m.obtenerPerfil.mockResolvedValue({ rol });
}

/** Vista mínima que registra un panel, como hace `CatalogoVista`, y expone su estado para comprobarlo. */
function VistaConPanel() {
  useRegistrarPanel();
  const p = usePanelCategorias();
  return <output data-testid="estado">{`${p.visibleEscritorio ? "lateral-visible" : "lateral-oculto"} ${p.abiertoMovil ? "movil-abierto" : "movil-cerrado"}`}</output>;
}

/** jsdom no implementa `matchMedia`: se simula el ancho (escritorio ≥ 64rem). */
function simularAncho(escritorio: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: escritorio, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}

describe("SiteHeader · enlace «Carrito» (CA-F12)", () => {
  it("lo muestra a un cliente con sesión, sin contador y sin consultar el carrito", async () => {
    conSesion("CLIENTE");
    render(<SiteHeader />);
    const enlace = await principal().findByRole("link", { name: "Carrito" });
    expect(enlace).toHaveAttribute("href", "/carrito");
    expect(enlace.textContent).toBe("Carrito");
    expect(inferior().getByRole("link", { name: "Carrito" })).toHaveAttribute("href", "/carrito");
    expect(m.obtenerCarrito).not.toHaveBeenCalled();
  });

  it("no lo muestra a un visitante", async () => {
    conSesion(null);
    render(<SiteHeader />);
    await principal().findByRole("link", { name: "Ingresar" });
    expect(screen.queryByRole("link", { name: "Carrito" })).toBeNull();
  });

  it.each(["COMERCIANTE", "TRABAJADOR_PUESTO", "ADMINISTRADOR"])("no lo muestra a %s", async (rol) => {
    conSesion(rol);
    render(<SiteHeader />);
    await principal().findByRole("link", { name: "Mi cuenta" });
    await waitFor(() => expect(screen.queryByRole("link", { name: "Carrito" })).toBeNull());
  });
});

describe("SiteHeader · encabezado y barra inferior por rol (spec 004, E4: CA-UI-02, CA-UI-03)", () => {
  it("visitante: Inicio, Catálogo, Ofertas, Ingresar y Crear cuenta arriba; abajo, Inicio, Catálogo, Ofertas e Ingresar", async () => {
    conSesion(null);
    render(<SiteHeader />);
    await principal().findByRole("link", { name: "Ingresar" });
    expect(textos(principal())).toEqual(["Inicio", "Catálogo", "Ofertas", "Ingresar", "Crear cuenta"]);
    expect(textos(inferior())).toEqual(["Inicio", "Catálogo", "Ofertas", "Ingresar"]);
  });

  it("cliente: el carrito va en el centro de la barra inferior", async () => {
    conSesion("CLIENTE");
    render(<SiteHeader />);
    await inferior().findByRole("link", { name: "Carrito" });
    expect(textos(inferior())).toEqual(["Inicio", "Catálogo", "Carrito", "Ofertas", "Mi cuenta"]);
    expect(textos(principal())).toEqual(["Inicio", "Catálogo", "Ofertas", "Carrito", "Mi cuenta"]);
  });

  it.each([
    ["COMERCIANTE", ["Inicio", "Catálogo", "Ofertas", "Mis productos", "Mi cuenta"], "/panel/productos"],
    ["ADMINISTRADOR", ["Inicio", "Catálogo", "Ofertas", "Panel", "Mi cuenta"], "/panel"],
  ])("%s: su panel en la barra inferior", async (rol, esperado, href) => {
    conSesion(rol);
    render(<SiteHeader />);
    await inferior().findByRole("link", { name: "Mi cuenta" });
    expect(textos(inferior())).toEqual(esperado);
    expect(inferior().getByRole("link", { name: esperado[3] })).toHaveAttribute("href", href);
  });

  it.each([
    ["/", "Inicio"],
    ["/catalogo", "Catálogo"],
    ["/catalogo/123", "Catálogo"],
    ["/ofertas", "Ofertas"],
  ])("en %s marca «%s» como página actual en ambas navegaciones", async (ruta, nombre) => {
    m.ruta.actual = ruta;
    conSesion(null);
    render(<SiteHeader />);
    await principal().findByRole("link", { name: "Ingresar" });
    for (const nav of [principal(), inferior()]) {
      const actuales = nav.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page");
      expect(actuales.map((a) => a.textContent)).toEqual([nombre]);
    }
  });

  it("mientras se resuelve la sesión no muestra enlaces de cuenta ni carrito", () => {
    m.getSession.mockReturnValue(new Promise(() => {}));
    render(<SiteHeader />);
    expect(textos(inferior())).toEqual(["Inicio", "Catálogo", "Ofertas"]);
    expect(textos(principal())).toEqual(["Inicio", "Catálogo", "Ofertas"]);
  });
});

describe("SiteHeader · marca y enlace «Inicio» (spec 004, E1: CA-CAT-15, CA-CAT-18)", () => {
  beforeEach(() => {
    conSesion(null);
    reiniciarPanelCategorias();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sin panel de categorías, el logotipo es un enlace al inicio y existe un enlace «Inicio» independiente", async () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Mercado de Abastos" })).toHaveAttribute("href", "/");
    expect(principal().getByRole("link", { name: "Inicio" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: /Mercado de Abastos/ })).toBeNull();
    await principal().findByRole("link", { name: "Ingresar" });
  });

  it("escritorio: con el panel montado, el logotipo es un botón que oculta y vuelve a mostrar el panel lateral", async () => {
    render(
      <>
        <SiteHeader />
        <VistaConPanel />
      </>,
    );
    const marca = screen.getByRole("button", { name: "Mercado de Abastos: panel de categorías" });
    expect(screen.queryByRole("link", { name: /Mercado de Abastos/ })).toBeNull();
    expect(principal().getByRole("link", { name: "Inicio" })).toHaveAttribute("href", "/"); // el inicio sigue accesible
    expect(marca).toHaveAttribute("aria-controls", ID_PANEL_LATERAL);
    expect(marca).toHaveAttribute("aria-expanded", "true");
    expect(marca).toHaveAttribute("title", "Ocultar categorías");

    await userEvent.click(marca);
    expect(marca).toHaveAttribute("aria-expanded", "false");
    expect(marca).toHaveAttribute("title", "Mostrar categorías");
    expect(screen.getByTestId("estado")).toHaveTextContent("lateral-oculto movil-cerrado");

    await userEvent.click(marca);
    expect(marca).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("estado")).toHaveTextContent("lateral-visible movil-cerrado");
  });

  it("móvil: el logotipo controla el panel superpuesto, cerrado al entrar", async () => {
    simularAncho(false);
    render(
      <>
        <SiteHeader />
        <VistaConPanel />
      </>,
    );
    const marca = screen.getByRole("button", { name: /Mercado de Abastos/ });
    expect(marca).toHaveAttribute("aria-controls", ID_PANEL_MOVIL);
    expect(marca).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(marca);
    expect(marca).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("estado")).toHaveTextContent("lateral-visible movil-abierto");
  });

  it("al desmontarse la vista del catálogo, el logotipo vuelve a ser un enlace y el panel móvil queda cerrado", async () => {
    simularAncho(false);
    const vista = render(<VistaConPanel />);
    render(<SiteHeader />);
    await userEvent.click(screen.getByRole("button", { name: /Mercado de Abastos/ }));
    act(() => vista.unmount());
    expect(screen.getByRole("link", { name: "Mercado de Abastos" })).toHaveAttribute("href", "/");
    render(<VistaConPanel />);
    expect(screen.getByRole("button", { name: /Mercado de Abastos/ })).toHaveAttribute("aria-expanded", "false");
  });
});
