import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductoCatalogo } from "@/lib/tipos";

const m = vi.hoisted(() => ({ getSession: vi.fn(), signOut: vi.fn(), obtenerPerfil: vi.fn(), agregarAlCarrito: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: () => ({ auth: { getSession: m.getSession, signOut: m.signOut } }) }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), obtenerPerfil: m.obtenerPerfil, agregarAlCarrito: m.agregarAlCarrito }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: m.replace, push: vi.fn() }) }));

import { TarjetaProducto } from "@/components/catalogo/TarjetaProducto";
import { AvisoFlotanteCarrito, BotonAgregar, useAgregarAlCarrito } from "@/components/tienda/AgregarAlCarrito";
import { ErrorApi } from "@/lib/api";

const producto = (n: number, nombre: string): ProductoCatalogo => ({
  id: `33333333-3333-4333-8333-${String(n).padStart(12, "0")}`,
  nombre,
  descripcion: null,
  precio: "8.50",
  unidadVenta: "KILOGRAMO",
  presentacion: null,
  categoria: { id: "c", nombre: "Frutas", slug: "frutas" },
  puesto: { id: "p", codigo: "A-1", nombre: "Puesto A" },
  imagenes: [],
});
const PALTA = producto(1, "Palta fuerte");
const MANGO = producto(2, "Mango Kent");

/** Vista mínima como la del catálogo o el inicio: una sesión, varias tarjetas y un aviso. */
function Vista() {
  const c = useAgregarAlCarrito();
  return (
    <>
      {[PALTA, MANGO].map((p) => (
        <TarjetaProducto key={p.id} producto={p} accion={<BotonAgregar producto={p} sesion={c.sesion} enviando={c.enviando} alAgregar={c.agregar} />} />
      ))}
      <AvisoFlotanteCarrito aviso={c.aviso} alCerrar={c.cerrarAviso} />
    </>
  );
}

function conSesion(rol: string | null) {
  if (rol === null) return m.getSession.mockResolvedValue({ data: { session: null } });
  m.getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
  m.obtenerPerfil.mockResolvedValue({ rol });
}

beforeEach(() => Object.values(m).forEach((f) => f.mockReset()));

describe("Agregar al carrito desde la tarjeta (spec 004, E4: CA-UI-06, CA-UI-07)", () => {
  it("cliente: envía cantidad 1, bloquea mientras tanto y avisa con «Ver carrito»", async () => {
    conSesion("CLIENTE");
    let resolver!: () => void;
    m.agregarAlCarrito.mockReturnValue(new Promise<void>((r) => (resolver = r)));
    render(<Vista />);
    const boton = await screen.findByRole("button", { name: "Agregar Palta fuerte al carrito" });
    await userEvent.click(boton);
    expect(m.agregarAlCarrito).toHaveBeenCalledWith(PALTA.id, 1);
    expect(boton).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Agregar Mango Kent al carrito" })).toBeDisabled(); // un envío a la vez
    resolver();
    const aviso = await screen.findByRole("status");
    expect(aviso).toHaveTextContent("Palta fuerte agregado al carrito");
    expect(within(aviso).getByRole("link", { name: "Ver carrito" })).toHaveAttribute("href", "/carrito");
    expect(boton).not.toBeDisabled();
  });

  it("la acción va fuera del enlace de la tarjeta (sin elementos interactivos anidados)", async () => {
    conSesion("CLIENTE");
    render(<Vista />);
    const boton = await screen.findByRole("button", { name: "Agregar Palta fuerte al carrito" });
    expect(boton.closest("a")).toBeNull();
    const tarjeta = boton.closest("article")!;
    expect(within(tarjeta).getByRole("link")).toHaveAttribute("href", `/catalogo/${PALTA.id}`);
  });

  it("un error del servidor (p. ej. sin stock) se muestra con su mensaje en un aviso de alerta que se puede cerrar", async () => {
    conSesion("CLIENTE");
    m.agregarAlCarrito.mockRejectedValue(new ErrorApi(409, "No hay stock suficiente: quedan 0 unidad(es) disponibles.", "STOCK_INSUFICIENTE"));
    render(<Vista />);
    await userEvent.click(await screen.findByRole("button", { name: "Agregar Mango Kent al carrito" }));
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("No hay stock suficiente");
    await userEvent.click(within(alerta).getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("un 401 cierra la sesión y lleva al ingreso (CA-F7), sin aviso de error", async () => {
    conSesion("CLIENTE");
    m.signOut.mockResolvedValue({});
    m.agregarAlCarrito.mockRejectedValue(new ErrorApi(401, "Sesión inválida o expirada.", "NO_AUTENTICADO"));
    render(<Vista />);
    await userEvent.click(await screen.findByRole("button", { name: "Agregar Palta fuerte al carrito" }));
    await waitFor(() => expect(m.replace).toHaveBeenCalledWith("/login"));
    expect(m.signOut).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("visitante: la acción es un enlace para ingresar; no hay botones de compra", async () => {
    conSesion(null);
    render(<Vista />);
    const enlace = await screen.findByRole("link", { name: "Ingresar para agregar Palta fuerte al carrito" });
    expect(enlace).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: /al carrito/ })).toBeNull();
    expect(m.agregarAlCarrito).not.toHaveBeenCalled();
  });

  it.each(["COMERCIANTE", "ADMINISTRADOR"])("%s: sin acción de compra (spec 002, CA-F8)", async (rol) => {
    conSesion(rol);
    render(<Vista />);
    await waitFor(() => expect(m.obtenerPerfil).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /al carrito/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /al carrito/ })).toBeNull();
  });
});
