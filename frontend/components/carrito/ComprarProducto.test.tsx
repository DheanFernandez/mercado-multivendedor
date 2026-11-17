import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { carritoTresPuestos } from "@/test/utilidades";

const m = vi.hoisted(() => ({ agregarAlCarrito: vi.fn(), replace: vi.fn(), signOut: vi.fn(), sesion: { estado: "cliente" } as { estado: string; rol?: string } }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), agregarAlCarrito: m.agregarAlCarrito }));
vi.mock("@/lib/hooks", () => ({ useSesion: () => m.sesion }));
vi.mock("@/lib/supabase", () => ({ supabase: () => ({ auth: { signOut: m.signOut } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: m.replace }) }));

import { ErrorApi } from "@/lib/api";
import { ComprarProducto } from "@/components/carrito/ComprarProducto";

const ID = "00000000-0000-4000-8000-000000000501";

beforeEach(() => {
  m.agregarAlCarrito.mockReset();
  m.replace.mockReset();
  m.signOut.mockReset();
  m.sesion = { estado: "cliente" };
});

describe("ComprarProducto · cliente (CA-F1)", () => {
  it("agrega la cantidad elegida y confirma con el total y un enlace al carrito", async () => {
    m.agregarAlCarrito.mockResolvedValue(carritoTresPuestos());
    render(<ComprarProducto productoId={ID} />);
    const campo = screen.getByLabelText("Cantidad");
    await userEvent.clear(campo);
    await userEvent.type(campo, "2");
    await userEvent.click(screen.getByRole("button", { name: "Agregar al carrito" }));
    expect(m.agregarAlCarrito).toHaveBeenCalledWith(ID, 2);
    expect(await screen.findByRole("status")).toHaveTextContent("Agregado al carrito");
    expect(screen.getByRole("status")).toHaveTextContent("S/ 79.77");
    expect(screen.getByRole("link", { name: "Ver mi carrito" })).toHaveAttribute("href", "/carrito");
  });

  it("una cantidad inválida no se envía y se explica", async () => {
    render(<ComprarProducto productoId={ID} />);
    const campo = screen.getByLabelText("Cantidad");
    for (const mala of ["0", "1.5", "abc", "10001"]) {
      await userEvent.clear(campo);
      await userEvent.type(campo, mala);
      await userEvent.click(screen.getByRole("button", { name: "Agregar al carrito" }));
      expect(await screen.findByRole("alert")).toBeInTheDocument();
    }
    expect(m.agregarAlCarrito).not.toHaveBeenCalled();
  });

  it("un 409 muestra el mensaje del servidor y conserva el formulario (CA-F7)", async () => {
    m.agregarAlCarrito.mockRejectedValue(new ErrorApi(409, "No hay stock suficiente: quedan 3 unidad(es) disponibles."));
    render(<ComprarProducto productoId={ID} />);
    await userEvent.click(screen.getByRole("button", { name: "Agregar al carrito" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("quedan 3");
    expect(screen.getByLabelText("Cantidad")).toHaveValue("1");
    expect(screen.getByRole("button", { name: "Agregar al carrito" })).toBeEnabled();
  });

  it.each([
    [404, "El producto no está disponible."],
    [400, "La cantidad debe ser mayor que cero."],
    [0, "No se pudo conectar con el servidor."],
  ])("el error %i se muestra junto al formulario (CA-F7)", async (estado, mensaje) => {
    m.agregarAlCarrito.mockRejectedValue(new ErrorApi(estado, mensaje));
    render(<ComprarProducto productoId={ID} />);
    await userEvent.click(screen.getByRole("button", { name: "Agregar al carrito" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(mensaje);
  });

  it("un 401 cierra la sesión local y redirige a /login (CA-F7)", async () => {
    m.agregarAlCarrito.mockRejectedValue(new ErrorApi(401, "Autenticación requerida."));
    render(<ComprarProducto productoId={ID} />);
    await userEvent.click(screen.getByRole("button", { name: "Agregar al carrito" }));
    await waitFor(() => expect(m.signOut).toHaveBeenCalled());
    expect(m.replace).toHaveBeenCalledWith("/login");
  });

  it("mientras envía deshabilita el botón y evita solicitudes duplicadas (CA-F10)", async () => {
    let resolver!: (c: unknown) => void;
    m.agregarAlCarrito.mockReturnValue(new Promise((r) => (resolver = r)));
    render(<ComprarProducto productoId={ID} />);
    await userEvent.click(screen.getByRole("button", { name: "Agregar al carrito" }));
    const boton = await screen.findByRole("button", { name: "Agregando…" });
    expect(boton).toBeDisabled();
    await userEvent.click(boton);
    expect(m.agregarAlCarrito).toHaveBeenCalledTimes(1);
    resolver(carritoTresPuestos());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Agregado"));
  });
});

describe("ComprarProducto · sin permiso de compra (CA-F8)", () => {
  it("el visitante ve «Ingresar para comprar» con enlace al login y ningún botón de agregar", () => {
    m.sesion = { estado: "visitante" };
    render(<ComprarProducto productoId={ID} />);
    expect(screen.getByRole("link", { name: "Ingresar para comprar" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: /agregar/i })).toBeNull();
  });

  it.each(["COMERCIANTE", "TRABAJADOR_PUESTO", "ADMINISTRADOR"])("%s ve «Solo los clientes compran» sin botón", (rol) => {
    m.sesion = { estado: "otro", rol };
    render(<ComprarProducto productoId={ID} />);
    expect(screen.getByText(/Solo los clientes compran/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /agregar/i })).toBeNull();
    expect(screen.queryByLabelText("Cantidad")).toBeNull();
  });

  it("mientras se resuelve la sesión no muestra ningún control de compra", () => {
    m.sesion = { estado: "cargando" };
    render(<ComprarProducto productoId={ID} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
