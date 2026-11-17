import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Categoria, Pagina, ProductoCatalogo } from "@/lib/tipos";

const m = vi.hoisted(() => ({ buscarCatalogo: vi.fn(), listarCategorias: vi.fn(), puestosPublicos: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  buscarCatalogo: m.buscarCatalogo,
  listarCategorias: m.listarCategorias,
  puestosPublicos: m.puestosPublicos,
}));
// Visitante sin sesión: el encabezado se monta en las pruebas de integración con el logotipo.
vi.mock("@/lib/supabase", () => ({
  supabase: () => ({
    auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  }),
}));
// La URL de jsdom es la fuente de verdad, como en Next.js: `useSearchParams` se vuelve a leer cuando la vista llama a
// `history.replaceState` (Next.js lo integra en su router; aquí lo hace el evento «prueba:url»).
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  const suscribir = (cb: () => void) => {
    window.addEventListener("prueba:url", cb);
    return () => window.removeEventListener("prueba:url", cb);
  };
  return {
    usePathname: () => "/catalogo",
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(suscribir, () => window.location.search)),
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  };
});

import { ErrorApi, MENSAJE_NO_API } from "@/lib/api";
import { CatalogoVista } from "@/components/catalogo/CatalogoVista";
import { SiteHeader } from "@/components/SiteHeader";
import { ID_PANEL_LATERAL, reiniciarPanelCategorias } from "@/lib/panelCategorias";

const CAT_FRUTAS = "11111111-1111-4111-8111-111111111111";
const CAT_VERDURAS = "11111111-1111-4111-8111-222222222222";
const PUESTO = "22222222-2222-4222-8222-222222222222";

const categoria = (id: string, nombre: string, slug: string): Categoria => ({ id, nombre, slug, descripcion: null, activa: true });
const producto = (n: number, p: Partial<ProductoCatalogo> = {}): ProductoCatalogo => ({
  id: `33333333-3333-4333-8333-${String(n).padStart(12, "0")}`,
  nombre: `Producto ${n}`,
  descripcion: null,
  precio: "4.50",
  unidadVenta: "KILOGRAMO",
  presentacion: null,
  categoria: { id: CAT_FRUTAS, nombre: "Frutas", slug: "frutas" },
  puesto: { id: PUESTO, codigo: "A-12", nombre: "Puesto prueba" },
  imagenes: [],
  ...p,
});
const pagina = (datos: ProductoCatalogo[], total = datos.length, numero = 1): Pagina<ProductoCatalogo> => ({ datos, pagina: numero, limite: 24, total, totalPaginas: Math.ceil(total / 24) });

const originalReplace = window.history.replaceState.bind(window.history);
const url = () => new URLSearchParams(window.location.search);
const ultimaConsulta = () => m.buscarCatalogo.mock.calls.at(-1)![0];
/** Barra lateral (escritorio). El diálogo móvil, cerrado, no es accesible. */
const lateral = () => screen.getByRole("complementary", { name: "Categorías" });

function montar(ruta = "/catalogo", { conEncabezado = false } = {}) {
  originalReplace(null, "", ruta);
  return render(
    <>
      {conEncabezado && <SiteHeader />}
      <CatalogoVista />
    </>,
  );
}

/**
 * jsdom no implementa `matchMedia` ni `showModal()`/`close()` del diálogo: se simulan para el caso móvil (< 64rem). El foco,
 * Esc y la animación reales se comprueban en Chromium (`e2e/catalogo.spec.ts`).
 */
const dialogoOriginal = { showModal: HTMLDialogElement.prototype.showModal, close: HTMLDialogElement.prototype.close };
function simularMovil() {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  reiniciarPanelCategorias();
  m.listarCategorias.mockResolvedValue([categoria(CAT_FRUTAS, "Frutas", "frutas"), categoria(CAT_VERDURAS, "Verduras", "verduras")]);
  m.puestosPublicos.mockResolvedValue([{ id: PUESTO, codigo: "A-12", nombre: "Puesto prueba" }]);
  vi.spyOn(window.history, "replaceState").mockImplementation((...args: Parameters<History["replaceState"]>) => {
    originalReplace(...args);
    window.dispatchEvent(new Event("prueba:url"));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.assign(HTMLDialogElement.prototype, dialogoOriginal);
});

describe("CatalogoVista · carga automática (CA-CAT-01, CA-CAT-05)", () => {
  it("al entrar consulta UNA vez la primera página sin filtros y muestra los productos sin ninguna acción", async () => {
    m.buscarCatalogo.mockResolvedValue(pagina([producto(1), producto(2)]));
    montar();
    expect(await screen.findByRole("heading", { name: "Producto 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Producto 2" })).toBeInTheDocument();
    expect(m.buscarCatalogo).toHaveBeenCalledTimes(1);
    const consulta = ultimaConsulta();
    expect(consulta).toMatchObject({ pagina: 1, limite: 24, orden: "recientes" });
    for (const k of ["q", "categoriaId", "puestoId", "precioMin", "precioMax"]) expect(consulta[k]).toBeUndefined();
    expect(screen.getByText("2 productos")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Todos los productos" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull(); // ningún formulario que completar antes de ver productos
  });

  it("mientras carga muestra el esqueleto con un estado accesible", () => {
    m.buscarCatalogo.mockReturnValue(new Promise(() => {}));
    montar();
    expect(screen.getAllByRole("status").some((s) => s.textContent?.includes("Cargando productos…"))).toBe(true);
  });

  it("al cambiar de categoría mantiene los resultados anteriores atenuados hasta la respuesta", async () => {
    let resolver!: (p: Pagina<ProductoCatalogo>) => void;
    m.buscarCatalogo.mockResolvedValueOnce(pagina([producto(1)])).mockReturnValueOnce(new Promise((r) => (resolver = r)));
    montar();
    await screen.findByRole("heading", { name: "Producto 1" });
    await userEvent.click(await within(lateral()).findByRole("button", { name: "Verduras" }));
    expect(screen.getByRole("heading", { name: "Producto 1" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Verduras" })).toHaveAttribute("aria-busy", "true");
    resolver(pagina([producto(7)]));
    expect(await screen.findByRole("heading", { name: "Producto 7" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Verduras" })).toHaveAttribute("aria-busy", "false");
  });
});

describe("CatalogoVista · categorías reales en la barra lateral (E1: CA-CAT-13, CA-CAT-14)", () => {
  beforeEach(() => {
    m.buscarCatalogo.mockResolvedValue(pagina([producto(1)]));
  });

  it("muestra «Todos» y exactamente las categorías que devuelve la API, en su orden", async () => {
    m.listarCategorias.mockResolvedValue([categoria(CAT_VERDURAS, "Lácteos", "lacteos"), categoria(CAT_FRUTAS, "Panadería", "panaderia")]);
    montar();
    const panel = lateral();
    await within(panel).findByRole("button", { name: "Lácteos" });
    expect(within(panel).getAllByRole("button").map((b) => b.textContent)).toEqual(["Todos", "Lácteos", "Panadería"]);
    expect(within(panel).queryByRole("button", { name: "Frutas" })).toBeNull(); // ninguna lista fija
    expect(within(panel).getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");
  });

  it("al elegir una categoría filtra al instante, la resalta y la escribe en la URL, sin botón «Aplicar»", async () => {
    montar();
    await screen.findByRole("heading", { name: "Producto 1" });
    await userEvent.click(await within(lateral()).findByRole("button", { name: "Frutas" }));
    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ categoriaId: CAT_FRUTAS, pagina: 1 }));
    expect(m.buscarCatalogo).toHaveBeenCalledTimes(2);
    expect(url().get("categoriaId")).toBe(CAT_FRUTAS);
    expect(within(lateral()).getByRole("button", { name: "Frutas" })).toHaveAttribute("aria-pressed", "true");
    expect(within(lateral()).getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("heading", { level: 2, name: "Frutas" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /aplicar/i })).toBeNull();
  });

  it("«Todos» quita la categoría y restaura el catálogo completo, conservando búsqueda, puesto y orden", async () => {
    montar(`/catalogo?q=papa&categoriaId=${CAT_VERDURAS}&puestoId=${PUESTO}&orden=nombre`);
    expect(await within(lateral()).findByRole("button", { name: "Verduras" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(within(lateral()).getByRole("button", { name: "Todos" }));
    await waitFor(() => expect(ultimaConsulta().categoriaId).toBeUndefined());
    expect(ultimaConsulta()).toMatchObject({ q: "papa", puestoId: PUESTO, orden: "nombre", pagina: 1 });
    expect(url().toString()).toBe(`q=papa&puestoId=${PUESTO}&orden=nombre`);
    expect(within(lateral()).getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");
  });

  it("mientras cargan las categorías muestra un estado accesible y solo «Todos»", () => {
    m.listarCategorias.mockReturnValue(new Promise(() => {}));
    montar();
    expect(within(lateral()).getByRole("status")).toHaveTextContent("Cargando categorías…");
    expect(within(lateral()).getAllByRole("button").map((b) => b.textContent)).toEqual(["Todos"]);
  });

  it("si las categorías fallan, avisa con «Reintentar» y el catálogo sigue funcionando", async () => {
    m.listarCategorias.mockRejectedValueOnce(new ErrorApi(500, "x", "ERROR_SERVIDOR")).mockResolvedValueOnce([categoria(CAT_FRUTAS, "Frutas", "frutas")]);
    montar();
    expect(await screen.findByRole("heading", { name: "Producto 1" })).toBeInTheDocument();
    const aviso = await within(lateral()).findByRole("alert");
    expect(aviso).toHaveTextContent("No se pudieron cargar las categorías.");
    await userEvent.click(within(aviso).getByRole("button", { name: "Reintentar" }));
    expect(await within(lateral()).findByRole("button", { name: "Frutas" })).toBeInTheDocument();
    expect(within(lateral()).queryByRole("alert")).toBeNull();
  });

  it("si no hay categorías registradas lo dice, y «Todos» sigue disponible", async () => {
    m.listarCategorias.mockResolvedValue([]);
    montar();
    expect(await within(lateral()).findByText("Aún no hay categorías registradas.")).toBeInTheDocument();
    expect(within(lateral()).getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("CatalogoVista · el logotipo oculta y muestra el panel lateral (E1: CA-CAT-15)", () => {
  it("escritorio: el logotipo es el control del panel; ocultarlo deja el panel inerte y la cuadrícula a todo el ancho", async () => {
    m.buscarCatalogo.mockResolvedValue(pagina([producto(1), producto(2)]));
    const { container } = montar("/catalogo", { conEncabezado: true });
    await screen.findByRole("heading", { name: "Producto 1" });
    const marca = screen.getByRole("button", { name: "Mercado de Abastos: panel de categorías" });
    const panel = lateral();
    const rejilla = container.querySelector("[data-panel]")!;
    expect(panel).toHaveAttribute("id", ID_PANEL_LATERAL);
    expect(marca).toHaveAttribute("aria-controls", ID_PANEL_LATERAL);
    expect(marca).toHaveAttribute("aria-expanded", "true");
    expect(panel).not.toHaveAttribute("inert");
    expect(rejilla).toHaveAttribute("data-panel", "visible");
    expect(within(screen.getByRole("navigation", { name: "Principal" })).getByRole("link", { name: "Inicio" })).toHaveAttribute("href", "/"); // CA-CAT-18

    await userEvent.click(marca);
    expect(marca).toHaveAttribute("aria-expanded", "false");
    expect(panel).toHaveAttribute("inert");
    expect(rejilla).toHaveAttribute("data-panel", "oculto");
    expect(rejilla.className).toContain("lg:grid-cols-[0rem_minmax(0,1fr)]");
    expect(screen.getByRole("heading", { name: "Producto 2" })).toBeInTheDocument(); // los productos siguen ahí
    expect(m.buscarCatalogo).toHaveBeenCalledTimes(1); // ocultar el panel no consulta de nuevo

    await userEvent.click(marca);
    expect(marca).toHaveAttribute("aria-expanded", "true");
    expect(panel).not.toHaveAttribute("inert");
    expect(rejilla).toHaveAttribute("data-panel", "visible");
  });

  it("el estado del panel se conserva al salir del catálogo y volver (misma pestaña)", async () => {
    m.buscarCatalogo.mockResolvedValue(pagina([producto(1)]));
    const primera = montar("/catalogo", { conEncabezado: true });
    await screen.findByRole("heading", { name: "Producto 1" });
    await userEvent.click(screen.getByRole("button", { name: /Mercado de Abastos/ }));
    primera.unmount();
    montar("/catalogo", { conEncabezado: true });
    await screen.findByRole("heading", { name: "Producto 1" });
    expect(screen.getByRole("button", { name: /Mercado de Abastos/ })).toHaveAttribute("aria-expanded", "false");
    expect(lateral()).toHaveAttribute("inert");
  });
});

describe("CatalogoVista · panel superpuesto en móvil (E1: CA-CAT-17)", () => {
  beforeEach(() => {
    simularMovil();
    m.buscarCatalogo.mockResolvedValue(pagina([producto(1)]));
  });

  it("«Categorías» abre el diálogo; elegir una categoría la aplica y lo cierra", async () => {
    montar();
    await screen.findByRole("heading", { name: "Producto 1" });
    expect(screen.queryByRole("dialog")).toBeNull();
    const boton = screen.getByRole("button", { name: "Categorías" });
    expect(boton).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(boton);
    const dialogo = screen.getByRole("dialog", { name: "Categorías" });
    expect(boton).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(await within(dialogo).findByRole("button", { name: "Verduras" }));
    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ categoriaId: CAT_VERDURAS, pagina: 1 }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("heading", { level: 2, name: "Verduras" })).toBeInTheDocument();
  });

  it("el logotipo también lo abre; se cierra con «Cerrar», con el fondo y con «Ver productos»", async () => {
    montar("/catalogo", { conEncabezado: true });
    await screen.findByRole("heading", { name: "Producto 1" });
    const marca = screen.getByRole("button", { name: /Mercado de Abastos/ });
    expect(marca).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(marca);
    expect(marca).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(within(screen.getByRole("dialog", { name: "Categorías" })).getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(marca).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(marca);
    await userEvent.click(screen.getByRole("dialog", { name: "Categorías" })); // pulsar el fondo (el propio <dialog>)
    expect(screen.queryByRole("dialog")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Categorías" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Ver productos" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(m.buscarCatalogo).toHaveBeenCalledTimes(1); // abrir y cerrar no consulta
  });

  it("el puesto se elige dentro del panel y se aplica al instante", async () => {
    montar();
    await screen.findByRole("heading", { name: "Producto 1" });
    await userEvent.click(screen.getByRole("button", { name: "Categorías" }));
    const dialogo = screen.getByRole("dialog", { name: "Categorías" });
    await waitFor(() => expect(within(dialogo).getByRole("combobox", { name: "Puesto" })).toBeEnabled());
    await userEvent.selectOptions(within(dialogo).getByRole("combobox", { name: "Puesto" }), PUESTO);
    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ puestoId: PUESTO }));
    expect(screen.getByRole("dialog", { name: "Categorías" })).toBeInTheDocument(); // sigue abierto para elegir más
  });
});

describe("CatalogoVista · vacío y sin resultados (CA-CAT-06, CA-CAT-07)", () => {
  it("catálogo vacío sin filtros: mensaje propio, sin «Limpiar filtros» y sin productos de ejemplo", async () => {
    m.buscarCatalogo.mockResolvedValue(pagina([], 0));
    montar();
    expect(await screen.findByRole("heading", { name: "Todavía no hay productos publicados" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpiar filtros" })).toBeNull();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("0 productos")).toBeInTheDocument();
  });

  it("sin resultados con filtros: mensaje distinto y «Limpiar filtros» vuelve a la consulta sin filtros", async () => {
    m.buscarCatalogo.mockResolvedValueOnce(pagina([], 0)).mockResolvedValueOnce(pagina([producto(1)]));
    montar("/catalogo?q=zzz&orden=nombre");
    expect(await screen.findByRole("heading", { name: "No encontramos productos con esos filtros" })).toBeInTheDocument();
    expect(ultimaConsulta()).toMatchObject({ q: "zzz", orden: "nombre" });
    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(await screen.findByRole("heading", { name: "Producto 1" })).toBeInTheDocument();
    expect(ultimaConsulta().q).toBeUndefined();
    expect(url().toString()).toBe("orden=nombre"); // conserva el orden elegido
  });
});

describe("CatalogoVista · errores diferenciados con «Reintentar» (CA-CAT-08)", () => {
  it.each([
    ["sin conexión", new ErrorApi(0, "No se pudo conectar con el servidor.", "SIN_CONEXION"), "No pudimos conectar con el mercado"],
    ["respuesta que no es de la API (404 HTML)", new ErrorApi(404, MENSAJE_NO_API, "RESPUESTA_NO_API"), "El catálogo no está disponible en este momento"],
    ["error del servidor", new ErrorApi(500, "x", "ERROR_SERVIDOR"), "El catálogo tuvo un problema al cargar"],
    ["filtro no válido", new ErrorApi(400, "El orden debe ser uno de: recientes, nombre, precio_asc, precio_desc.", "VALIDACION"), "Revise los filtros"],
  ])("%s: mensaje propio, nunca «Error inesperado.», y «Reintentar» repite la consulta", async (_caso, error, titulo) => {
    m.buscarCatalogo.mockRejectedValueOnce(error).mockResolvedValueOnce(pagina([producto(1)]));
    montar();
    const alerta = await screen.findByRole("alert");
    expect(within(alerta).getByRole("heading", { name: titulo })).toBeInTheDocument();
    expect(alerta).not.toHaveTextContent(/inesperado/i);
    expect(screen.queryByText(/^\d+ productos?$/)).toBeNull(); // no se muestra un recuento engañoso
    await userEvent.click(within(alerta).getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { name: "Producto 1" })).toBeInTheDocument();
    expect(m.buscarCatalogo).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("un 400 muestra el mensaje del servidor", async () => {
    m.buscarCatalogo.mockRejectedValue(new ErrorApi(400, "El orden debe ser uno de: recientes.", "VALIDACION"));
    montar();
    expect(await screen.findByRole("alert")).toHaveTextContent("El orden debe ser uno de: recientes.");
  });
});

describe("CatalogoVista · búsqueda, puesto, orden y URL (CA-CAT-10, CA-CAT-11, CA-CAT-19)", () => {
  beforeEach(() => {
    m.buscarCatalogo.mockResolvedValue(pagina([producto(1)]));
  });

  it("abrir una URL con filtros reproduce la vista", async () => {
    montar(`/catalogo?categoriaId=${CAT_VERDURAS}&puestoId=${PUESTO}&orden=nombre&pagina=2`);
    await screen.findByRole("heading", { name: "Producto 1" });
    expect(ultimaConsulta()).toMatchObject({ categoriaId: CAT_VERDURAS, puestoId: PUESTO, orden: "nombre", pagina: 2 });
    expect(await within(lateral()).findByRole("button", { name: "Verduras" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(within(lateral()).getByRole("combobox", { name: "Puesto" })).toHaveValue(PUESTO));
    expect(screen.getByRole("combobox", { name: "Ordenar por" })).toHaveValue("nombre");
  });

  it("no hay filtro de precio: ni rangos ni campos, y precioMin/precioMax de la URL no se envían", async () => {
    montar(`/catalogo?precioMin=5&precioMax=10&categoriaId=${CAT_FRUTAS}`);
    await screen.findByRole("heading", { name: "Producto 1" });
    const consulta = ultimaConsulta();
    expect(consulta.precioMin).toBeUndefined();
    expect(consulta.precioMax).toBeUndefined();
    expect(consulta).toMatchObject({ categoriaId: CAT_FRUTAS });
    expect(screen.queryByText(/rango de precio/i)).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("textbox", { name: /precio|mín|máx/i })).toBeNull();
    expect(within(screen.getByRole("list", { name: "Filtros activos" })).queryByText(/S\//)).toBeNull();
  });

  it("solo ofrece los órdenes del contrato", async () => {
    montar();
    await screen.findByRole("heading", { name: "Producto 1" });
    const opciones = within(screen.getByRole("combobox", { name: "Ordenar por" })).getAllByRole("option");
    expect(opciones.map((o) => o.textContent)).toEqual(["Más recientes", "Nombre (A–Z)", "Precio: menor a mayor", "Precio: mayor a menor"]);
  });

  it("la búsqueda se aplica al enviar, aparece como etiqueta y se quita con su botón", async () => {
    montar();
    await screen.findByRole("heading", { name: "Producto 1" });
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar productos" }), "papa");
    expect(m.buscarCatalogo).toHaveBeenCalledTimes(1); // sin consultas por tecla
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ q: "papa" }));
    expect(url().get("q")).toBe("papa");
    const activos = screen.getByRole("list", { name: "Filtros activos" });
    expect(within(activos).getByText("«papa»")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Quitar filtro: «papa»" }));
    await waitFor(() => expect(ultimaConsulta().q).toBeUndefined());
    expect(screen.queryByRole("list", { name: "Filtros activos" })).toBeNull();
  });

  it("orden y puesto se aplican al instante; «Limpiar todo» quita los filtros y conserva el orden", async () => {
    montar();
    await screen.findByRole("heading", { name: "Producto 1" });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Ordenar por" }), "precio_asc");
    const puesto = within(lateral()).getByRole("combobox", { name: "Puesto" });
    await waitFor(() => expect(puesto).toBeEnabled());
    await userEvent.selectOptions(puesto, PUESTO);
    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ orden: "precio_asc", puestoId: PUESTO, pagina: 1 }));
    expect(url().toString()).toBe(`puestoId=${PUESTO}&orden=precio_asc`);
    expect(within(screen.getByRole("list", { name: "Filtros activos" })).getByText("Puesto A-12")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpiar todo" }));
    await waitFor(() => expect(url().toString()).toBe("orden=precio_asc"));
  });

  it("la paginación cambia de página y la escribe en la URL", async () => {
    m.buscarCatalogo.mockResolvedValue(pagina([producto(1)], 30));
    montar();
    await screen.findByText("Página 1 de 2");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(ultimaConsulta()).toMatchObject({ pagina: 2 }));
    expect(url().get("pagina")).toBe("2");
  });
});
