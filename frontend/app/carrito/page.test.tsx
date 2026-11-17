import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { carritoVacio } from "@/test/utilidades";

const m = vi.hoisted(() => ({ replace: vi.fn(), getSession: vi.fn(), obtenerPerfil: vi.fn(), obtenerCarrito: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: m.replace }) }));
vi.mock("@/lib/supabase", () => ({ supabase: () => ({ auth: { getSession: m.getSession, signOut: vi.fn() } }) }));
vi.mock("@/lib/api", async (orig) => ({ ...(await orig<typeof import("@/lib/api")>()), obtenerPerfil: m.obtenerPerfil, obtenerCarrito: m.obtenerCarrito }));

import PaginaCarrito from "@/app/carrito/page";

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.obtenerCarrito.mockResolvedValue(carritoVacio());
});

describe("/carrito · acceso (CA-F8)", () => {
  it("sin sesión redirige a /login y no consulta el carrito", async () => {
    m.getSession.mockResolvedValue({ data: { session: null } });
    render(<PaginaCarrito />);
    await waitFor(() => expect(m.replace).toHaveBeenCalledWith("/login"));
    expect(m.obtenerCarrito).not.toHaveBeenCalled();
  });

  it.each(["COMERCIANTE", "TRABAJADOR_PUESTO", "ADMINISTRADOR"])("%s ve «Acceso restringido» y no consulta el carrito", async (rol) => {
    m.getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    m.obtenerPerfil.mockResolvedValue({ id: "u", rol });
    render(<PaginaCarrito />);
    expect(await screen.findByText("Acceso restringido")).toBeInTheDocument();
    expect(m.obtenerCarrito).not.toHaveBeenCalled();
  });

  it("un cliente con sesión ve «Mi carrito»", async () => {
    m.getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    m.obtenerPerfil.mockResolvedValue({ id: "u", rol: "CLIENTE" });
    render(<PaginaCarrito />);
    expect(await screen.findByText("Su carrito está vacío.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mi carrito" })).toBeInTheDocument();
  });
});
