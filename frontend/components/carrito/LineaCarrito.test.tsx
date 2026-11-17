import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { carritoTresPuestos, linea } from "@/test/utilidades";

const m = vi.hoisted(() => ({ actualizarCantidadCarrito: vi.fn(), quitarDelCarrito: vi.fn(), alCambiar: vi.fn(), replace: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  actualizarCantidadCarrito: m.actualizarCantidadCarrito,
  quitarDelCarrito: m.quitarDelCarrito,
}));
vi.mock("@/lib/supabase", () => ({ supabase: () => ({ auth: { signOut: m.signOut } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: m.replace }) }));

import { ErrorApi } from "@/lib/api";
import { LineaCarrito } from "@/components/carrito/LineaCarrito";

const ID = "00000000-0000-4000-8000-000000000501";
const montar = (p = {}) =>
  render(
    <ul>
      <LineaCarrito linea={linea({ productoId: ID, ...p })} alCambiar={m.alCambiar} />
    </ul>,
  );

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
});

describe("LineaCarrito · modificar y quitar (CA-F4, CA-F5, CA-F10)", () => {
  it("«Actualizar» envía la cantidad válida y entrega el carrito recibido", async () => {
    const nuevo = carritoTresPuestos();
    m.actualizarCantidadCarrito.mockResolvedValue(nuevo);
    montar();
    const campo = screen.getByLabelText("Cantidad de Mango");
    expect(campo).toHaveValue("3");
    await userEvent.clear(campo);
    await userEvent.type(campo, "7");
    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(m.actualizarCantidadCarrito).toHaveBeenCalledWith(ID, 7);
    await waitFor(() => expect(m.alCambiar).toHaveBeenCalledWith(nuevo));
  });

  it("cantidades inválidas no se envían y se explican", async () => {
    montar();
    const campo = screen.getByLabelText("Cantidad de Mango");
    for (const mala of ["", "0", "-2", "1.5", "abc", "10001"]) {
      await userEvent.clear(campo);
      if (mala) await userEvent.type(campo, mala);
      await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
      expect(await screen.findByRole("alert")).toBeInTheDocument();
    }
    expect(m.actualizarCantidadCarrito).not.toHaveBeenCalled();
  });

  it("«Quitar» llama a quitarDelCarrito y entrega el carrito recibido", async () => {
    const nuevo = carritoTresPuestos();
    m.quitarDelCarrito.mockResolvedValue(nuevo);
    montar();
    await userEvent.click(screen.getByRole("button", { name: "Quitar" }));
    expect(m.quitarDelCarrito).toHaveBeenCalledWith(ID);
    await waitFor(() => expect(m.alCambiar).toHaveBeenCalledWith(nuevo));
  });

  it("mientras envía deshabilita los controles de la línea y no duplica solicitudes", async () => {
    let resolver!: (c: unknown) => void;
    m.actualizarCantidadCarrito.mockReturnValue(new Promise((r) => (resolver = r)));
    montar();
    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(await screen.findByText("Guardando…")).toBeInTheDocument();
    expect(screen.getByLabelText("Cantidad de Mango")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Quitar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Actualizar" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(m.actualizarCantidadCarrito).toHaveBeenCalledTimes(1);
    resolver(carritoTresPuestos());
    await waitFor(() => expect(screen.getByRole("button", { name: "Quitar" })).toBeEnabled());
  });
});

describe("LineaCarrito · botones −/+ (spec 004, CA-CAR-02, CA-CAR-03)", () => {
  it("+ envía la cantidad + 1 y − la cantidad − 1, y entregan el carrito recibido", async () => {
    const nuevo = carritoTresPuestos();
    m.actualizarCantidadCarrito.mockResolvedValue(nuevo);
    montar();
    await userEvent.click(screen.getByRole("button", { name: "Sumar uno a Mango" }));
    expect(m.actualizarCantidadCarrito).toHaveBeenLastCalledWith(ID, 4);
    await waitFor(() => expect(m.alCambiar).toHaveBeenCalledWith(nuevo));
    await userEvent.click(screen.getByRole("button", { name: "Restar uno a Mango" }));
    expect(m.actualizarCantidadCarrito).toHaveBeenLastCalledWith(ID, 2);
  });

  it("− se deshabilita en 1 (para retirar se usa «Quitar») y + al alcanzar lo disponible", () => {
    const { unmount } = montar({ cantidad: 1 });
    expect(screen.getByRole("button", { name: "Restar uno a Mango" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sumar uno a Mango" })).toBeEnabled();
    unmount();
    montar({ cantidad: 10, disponible: 10 });
    expect(screen.getByRole("button", { name: "Sumar uno a Mango" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Restar uno a Mango" })).toBeEnabled();
  });

  it("con stock insuficiente permite bajar la cantidad pero no subirla", () => {
    montar({ estado: "STOCK_INSUFICIENTE", cantidad: 5, disponible: 3 });
    expect(screen.getByRole("button", { name: "Sumar uno a Mango" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Restar uno a Mango" })).toBeEnabled();
  });

  it("mientras envía, −/+ también se bloquean y no duplican solicitudes", async () => {
    let resolver!: (c: unknown) => void;
    m.actualizarCantidadCarrito.mockReturnValue(new Promise((r) => (resolver = r)));
    montar();
    await userEvent.click(screen.getByRole("button", { name: "Sumar uno a Mango" }));
    expect(await screen.findByText("Guardando…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sumar uno a Mango" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Restar uno a Mango" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Sumar uno a Mango" }));
    expect(m.actualizarCantidadCarrito).toHaveBeenCalledTimes(1);
    resolver(carritoTresPuestos());
    await waitFor(() => expect(screen.getByRole("button", { name: "Quitar" })).toBeEnabled());
  });

  it("un producto no disponible no ofrece −/+", () => {
    montar({ estado: "NO_DISPONIBLE", nombre: null, precioUnitario: null, subtotal: null, disponible: 0 });
    expect(screen.queryByRole("button", { name: /Sumar uno|Restar uno/ })).toBeNull();
  });
});

describe("LineaCarrito · disponibilidad (CA-F6)", () => {
  it("stock insuficiente: indica cuántas unidades quedan y destaca la línea", () => {
    montar({ estado: "STOCK_INSUFICIENTE", disponible: 3, cantidad: 5 });
    expect(screen.getByText("Quedan 3")).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveAttribute("data-estado", "STOCK_INSUFICIENTE");
    expect(screen.getByRole("button", { name: "Actualizar" })).toBeEnabled();
  });

  it("stock insuficiente con 0 unidades: «Agotado»", () => {
    montar({ estado: "STOCK_INSUFICIENTE", disponible: 0 });
    expect(screen.getByText("Agotado")).toBeInTheDocument();
  });

  it("producto no disponible: sin precio ni edición de cantidad, solo «Quitar»", async () => {
    m.quitarDelCarrito.mockResolvedValue(carritoTresPuestos());
    montar({ estado: "NO_DISPONIBLE", nombre: null, precioUnitario: null, subtotal: null, disponible: 0 });
    expect(screen.getByText("Este producto ya no está disponible")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actualizar" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText(/S\//)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Quitar" }));
    expect(m.quitarDelCarrito).toHaveBeenCalledWith(ID);
  });

  it("una línea vigente no muestra aviso de disponibilidad", () => {
    montar();
    expect(screen.getByRole("listitem")).toHaveAttribute("data-estado", "OK");
    expect(screen.queryByText(/Quedan|Agotado|ya no está disponible/)).toBeNull();
  });
});

describe("LineaCarrito · errores del servidor (CA-F7)", () => {
  it.each([
    [409, "No hay stock suficiente: quedan 3 unidad(es) disponibles."],
    [404, "El producto no está disponible."],
    [400, "La cantidad debe ser mayor que cero."],
    [0, "No se pudo conectar con el servidor."],
  ])("al actualizar, el error %i se muestra junto a la línea y no cambia el carrito mostrado", async (estado, mensaje) => {
    m.actualizarCantidadCarrito.mockRejectedValue(new ErrorApi(estado, mensaje));
    montar();
    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(mensaje);
    expect(m.alCambiar).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Cantidad de Mango")).toHaveValue("3");
    expect(screen.getByRole("button", { name: "Actualizar" })).toBeEnabled();
  });

  it("al quitar, el error se muestra y la línea sigue visible", async () => {
    m.quitarDelCarrito.mockRejectedValue(new ErrorApi(404, "El producto no está en el carrito."));
    montar();
    await userEvent.click(screen.getByRole("button", { name: "Quitar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no está en el carrito");
    expect(screen.getByText("Mango")).toBeInTheDocument();
  });

  it("un 401 cierra la sesión local y redirige a /login", async () => {
    m.actualizarCantidadCarrito.mockRejectedValue(new ErrorApi(401, "Autenticación requerida."));
    montar();
    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await waitFor(() => expect(m.signOut).toHaveBeenCalled());
    expect(m.replace).toHaveBeenCalledWith("/login");
  });
});
