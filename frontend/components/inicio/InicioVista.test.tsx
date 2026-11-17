import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Categoria, Pagina, ProductoCatalogo } from "@/lib/tipos";

const m = vi.hoisted(() => ({ buscarCatalogo: vi.fn(), listarCategorias: vi.fn(), puestosPublicos: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), buscarCatalogo: m.buscarCatalogo, listarCategorias: m.listarCategorias, puestosPublicos: m.puestosPublicos }));
vi.mock("@/lib/supabase", () => ({ supabase: () => ({ auth: { getSession: () => Promise.resolve({ data: { session: null } }) } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
// `next/form` necesita el enrutador de Next.js; en jsdom basta un formulario GET normal (su comportamiento sin JavaScript).
vi.mock("next/form", () => ({ default: (p: ComponentProps<"form">) => <form method="get" {...p} /> }));

import { InicioVista } from "@/components/inicio/InicioVista";
import { ErrorApi } from "@/lib/api";

const categoria = (id: string, nombre: string, slug: string): Categoria => ({ id, nombre, slug, descripcion: null, activa: true });
const CATS = [categoria("c1", "Frutas", "frutas"), categoria("c2", "Tubérculos", "tuberculos"), categoria("c3", "Lácteos y huevos", "lacteos-y-huevos")];
const PUESTOS = [
  { id: "p1", codigo: "A-1", nombre: "Frutería Uno" },
  { id: "p2", codigo: "B-2", nombre: "Verduras Dos" },
];
const producto = (n: number, nombre: string, precio: string): ProductoCatalogo => ({
  id: `33333333-3333-4333-8333-${String(n).padStart(12, "0")}`,
  nombre,
  descripcion: null,
  precio,
  unidadVenta: "KILOGRAMO",
  presentacion: null,
  categoria: { id: "c1", nombre: "Frutas", slug: "frutas" },
  puesto: { id: "p1", codigo: "A-1", nombre: "Frutería Uno" },
  imagenes: [],
});
const pagina = (datos: ProductoCatalogo[], total = datos.length): Pagina<ProductoCatalogo> => ({ datos, pagina: 1, limite: 8, total, totalPaginas: 1 });
const NOVEDADES = pagina([producto(1, "Palta fuerte", "8.50"), producto(2, "Mango Kent", "6.00")], 20);
const ECONOMICOS = pagina([producto(3, "Culantro", "1.00")], 20);

function responder({ novedades = NOVEDADES, economicos = ECONOMICOS }: { novedades?: Pagina<ProductoCatalogo> | Error; economicos?: Pagina<ProductoCatalogo> } = {}) {
  m.buscarCatalogo.mockImplementation((f: { orden?: string }) => {
    const r = f.orden === "precio_asc" ? economicos : novedades;
    return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
  });
}

const seccion = (nombre: string) => screen.getByRole("region", { name: nombre });

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.listarCategorias.mockResolvedValue(CATS);
  m.puestosPublicos.mockResolvedValue(PUESTOS);
  responder();
});

describe("InicioVista · datos reales (spec 004, E4: CA-UI-04)", () => {
  it("hero con título, buscador GET /catalogo?q= y acceso al catálogo", async () => {
    render(<InicioVista />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Compra productos frescos del mercado, en un solo lugar");
    const buscador = screen.getByRole("search");
    expect(buscador).toHaveAttribute("action", "/catalogo");
    expect(within(buscador).getByRole("searchbox", { name: "Buscar productos" })).toHaveAttribute("name", "q");
    expect(within(buscador).getByRole("button", { name: "Buscar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver catálogo/ })).toHaveAttribute("href", "/catalogo");
    await screen.findByRole("heading", { name: "Palta fuerte" });
  });

  it("categorías visuales: «Todos» y las de la API, que enlazan al catálogo filtrado", async () => {
    render(<InicioVista />);
    const nav = screen.getByRole("navigation", { name: "Categorías del mercado" });
    await within(nav).findByRole("link", { name: "Frutas" });
    expect(within(nav).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Todos", "/catalogo"],
      ["Frutas", "/catalogo?categoriaId=c1"],
      ["Tubérculos", "/catalogo?categoriaId=c2"],
      ["Lácteos y huevos", "/catalogo?categoriaId=c3"],
    ]);
  });

  it("novedades (orden=recientes, 8) y precios más bajos (orden=precio_asc, 4), con tarjetas reales", async () => {
    render(<InicioVista />);
    expect(await within(seccion("Novedades del mercado")).findByRole("heading", { name: "Palta fuerte" })).toBeInTheDocument();
    expect(within(seccion("Novedades del mercado")).getByRole("heading", { name: "Mango Kent" })).toBeInTheDocument();
    expect(await within(seccion("Precios más bajos")).findByRole("heading", { name: "Culantro" })).toBeInTheDocument();
    expect(m.buscarCatalogo).toHaveBeenCalledWith({ pagina: 1, limite: 8, orden: "recientes" });
    expect(m.buscarCatalogo).toHaveBeenCalledWith({ pagina: 1, limite: 4, orden: "precio_asc" });
    expect(within(seccion("Precios más bajos")).getByRole("link", { name: /Ver todos/ })).toHaveAttribute("href", "/catalogo?orden=precio_asc");
  });

  it("compra por puesto y franja promocional con el número REAL de puestos", async () => {
    render(<InicioVista />);
    const puestos = seccion("Compra por puesto");
    expect(await within(puestos).findByRole("link", { name: /Frutería Uno/ })).toHaveAttribute("href", "/catalogo?puestoId=p1");
    expect(within(puestos).getByRole("link", { name: /Verduras Dos/ })).toHaveAttribute("href", "/catalogo?puestoId=p2");
    const promo = seccion("Un solo carrito, varios puestos");
    expect(within(promo).getByText("2")).toBeInTheDocument();
    expect(within(promo).getByText("puestos")).toBeInTheDocument();
  });

  it("el resumen «El mercado hoy» usa recuentos reales (total del catálogo, puestos y categorías)", async () => {
    render(<InicioVista />);
    const resumen = screen.getByRole("complementary", { name: "El mercado hoy" });
    await within(resumen).findByText("20");
    expect(resumen).toHaveTextContent("20productos publicados");
    expect(resumen).toHaveTextContent("2puestos vendiendo");
    expect(resumen).toHaveTextContent("3categorías");
  });

  it("banner principal: 3 mensajes editoriales que cambian solo cuando se pide", async () => {
    render(<InicioVista />);
    const banner = screen.getByRole("region", { name: "Mensajes del mercado" });
    expect(within(banner).getByRole("heading", { name: "Productos frescos del día" })).toBeInTheDocument();
    const puntos = within(banner).getAllByRole("button", { name: /Mostrar mensaje/ });
    expect(puntos).toHaveLength(3);
    expect(puntos[0]).toHaveAttribute("aria-current", "true");
    await userEvent.click(puntos[1]!);
    expect(within(banner).getByRole("heading", { name: "Compra directo de los puestos" })).toBeInTheDocument();
    expect(within(banner).getByRole("link", { name: /Ver puestos/ })).toHaveAttribute("href", "#puestos");
    await userEvent.click(puntos[2]!);
    expect(await within(banner).findByRole("link", { name: /Ver frutas/ })).toHaveAttribute("href", "/catalogo?categoriaId=c1");
  });

  it("visitante: cada tarjeta ofrece ingresar para agregar al carrito", async () => {
    render(<InicioVista />);
    expect(await within(seccion("Novedades del mercado")).findByRole("link", { name: "Ingresar para agregar Palta fuerte al carrito" })).toHaveAttribute("href", "/login");
  });
});

describe("InicioVista · sin datos inventados (CA-UI-05)", () => {
  it("no hay porcentajes, precios anteriores, valoraciones ni insignias de ventas o novedad", async () => {
    const { container } = render(<InicioVista />);
    await screen.findByRole("heading", { name: "Palta fuerte" });
    await within(seccion("Compra por puesto")).findByRole("link", { name: /Frutería Uno/ });
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/%|descuento|antes:? ?s\/|ahorra s\/|★|valoraci|reseña|más vendido|popular|\bnuevo\b|oferta del día|\boff\b/i);
    // Precios: solo los de la API (S/ 8.50, S/ 6.00 y S/ 1.00), una vez por tarjeta
    expect((texto.match(/S\/ \d+\.\d{2}/g) ?? []).sort()).toEqual(["S/ 1.00", "S/ 6.00", "S/ 8.50"]);
  });
});

describe("InicioVista · estados de cada sección", () => {
  it("si los productos fallan, avisa con «Reintentar» y vuelve a consultar", async () => {
    responder({ novedades: new ErrorApi(500, "x", "ERROR_SERVIDOR") });
    render(<InicioVista />);
    const aviso = await within(seccion("Novedades del mercado")).findByRole("alert");
    expect(aviso).toHaveTextContent("No se pudieron cargar los productos.");
    responder();
    await userEvent.click(within(aviso).getByRole("button", { name: "Reintentar" }));
    expect(await within(seccion("Novedades del mercado")).findByRole("heading", { name: "Palta fuerte" })).toBeInTheDocument();
  });

  it("sin productos publicados, lo dice en lugar de mostrar tarjetas", async () => {
    responder({ novedades: pagina([], 0), economicos: pagina([], 0) });
    render(<InicioVista />);
    expect(await within(seccion("Novedades del mercado")).findByText("Todavía no hay productos publicados.")).toBeInTheDocument();
    await waitFor(() => expect(within(seccion("Precios más bajos")).getByText("Todavía no hay productos publicados.")).toBeInTheDocument());
  });

  it("sin puestos, no muestra el sello de la franja promocional", async () => {
    m.puestosPublicos.mockResolvedValue([]);
    render(<InicioVista />);
    expect(await within(seccion("Compra por puesto")).findByText("Aún no hay puestos vendiendo en la plataforma.")).toBeInTheDocument();
    const promo = within(seccion("Un solo carrito, varios puestos"));
    expect(promo.queryByText("puestos")).toBeNull();
    expect(promo.queryByText("puesto")).toBeNull();
    expect(promo.queryByText("0")).toBeNull();
  });
});
