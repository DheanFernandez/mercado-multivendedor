import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductoCatalogo } from "@/lib/tipos";

const m = vi.hoisted(() => ({ buscarCatalogo: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), buscarCatalogo: m.buscarCatalogo }));
vi.mock("@/lib/supabase", () => ({ supabase: () => ({ auth: { getSession: () => Promise.resolve({ data: { session: null } }) } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

import { OfertasVista } from "@/components/ofertas/OfertasVista";

const producto = (n: number, nombre: string, precio: string): ProductoCatalogo => ({
  id: `33333333-3333-4333-8333-${String(n).padStart(12, "0")}`,
  nombre,
  descripcion: null,
  precio,
  unidadVenta: "MANOJO",
  presentacion: null,
  categoria: { id: "c", nombre: "Verduras", slug: "verduras" },
  puesto: { id: "p", codigo: "B-2", nombre: "Verduras Dos" },
  imagenes: [],
});

beforeEach(() => {
  m.buscarCatalogo.mockReset();
  m.buscarCatalogo.mockResolvedValue({ datos: [producto(1, "Culantro", "1.00"), producto(2, "Cebolla roja", "3.00")], pagina: 1, limite: 8, total: 20, totalPaginas: 3 });
});

describe("OfertasVista (spec 004, E4: CA-UI-05, CA-UI-08)", () => {
  it("dice que aún no hay ofertas publicadas y ofrece los precios más bajos reales y el catálogo", async () => {
    render(<OfertasVista />);
    expect(screen.getByRole("heading", { level: 1, name: "Ofertas del mercado" })).toBeInTheDocument();
    const aviso = screen.getByRole("region", { name: "Aún no hay ofertas publicadas" });
    expect(within(aviso).getByRole("link", { name: "Ver precios más bajos" })).toHaveAttribute("href", "#precios-bajos");
    expect(within(aviso).getByRole("link", { name: /Ir al catálogo/ })).toHaveAttribute("href", "/catalogo");
    const precios = screen.getByRole("region", { name: "Precios más bajos" });
    expect(await within(precios).findByRole("heading", { name: "Culantro" })).toBeInTheDocument();
    expect(m.buscarCatalogo).toHaveBeenCalledWith({ pagina: 1, limite: 8, orden: "precio_asc" });
  });

  it("no inventa descuentos, porcentajes, precios anteriores ni vigencias", async () => {
    const { container } = render(<OfertasVista />);
    await screen.findByRole("heading", { name: "Culantro" });
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/%|descuento|antes:? ?s\/|hasta el|válido|vigente|★|más vendido|\boff\b/i);
    expect((texto.match(/S\/ \d+\.\d{2}/g) ?? []).sort()).toEqual(["S/ 1.00", "S/ 3.00"]);
  });
});
