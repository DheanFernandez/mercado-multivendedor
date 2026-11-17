import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUESTOS, carritoTresPuestos, carritoVacio, linea } from "@/test/utilidades";

const m = vi.hoisted(() => ({ obtenerCarrito: vi.fn(), actualizarCantidadCarrito: vi.fn(), quitarDelCarrito: vi.fn(), vaciarCarrito: vi.fn(), replace: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  obtenerCarrito: m.obtenerCarrito,
  actualizarCantidadCarrito: m.actualizarCantidadCarrito,
  quitarDelCarrito: m.quitarDelCarrito,
  vaciarCarrito: m.vaciarCarrito,
}));
vi.mock("@/lib/supabase", () => ({ supabase: () => ({ auth: { signOut: m.signOut } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: m.replace }) }));

import { ErrorApi } from "@/lib/api";
import { CarritoVista } from "@/components/carrito/CarritoVista";

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
});

describe("CarritoVista · consulta (CA-F2, CA-F3, CA-F9, CA-F11)", () => {
  it("agrupa por puesto y muestra subtotales y total exactamente como los entrega la API", async () => {
    m.obtenerCarrito.mockResolvedValue(carritoTresPuestos());
    render(<CarritoVista />);
    const grupos = await screen.findAllByRole("region");
    expect(grupos).toHaveLength(3);
    expect(within(grupos[0]!).getByRole("heading", { name: "A-1 · Puesto A" })).toBeInTheDocument();
    expect(within(grupos[1]!).getByRole("heading", { name: "B-1 · Puesto B" })).toBeInTheDocument();
    expect(within(grupos[0]!).getByText("Mango")).toBeInTheDocument();
    expect(within(grupos[0]!).getByText("S/ 6.50")).toBeInTheDocument();
    expect(within(grupos[0]!).getByText("S/ 19.50", { selector: "[data-subtotal-linea]" })).toBeInTheDocument();
    // Importes que la coma flotante sumaría mal: se muestran tal cual llegan.
    expect(within(grupos[1]!).getByText("Subtotal del puesto: S/ 0.30")).toBeInTheDocument();
    expect(within(grupos[2]!).getByText("Subtotal del puesto: S/ 59.97")).toBeInTheDocument();
    expect(screen.getByText("S/ 79.77")).toBeInTheDocument();
  });

  it("rotula el total como importe estimado y no ofrece pedido ni pago (CA-F11)", async () => {
    m.obtenerCarrito.mockResolvedValue(carritoTresPuestos());
    render(<CarritoVista />);
    await screen.findAllByRole("region");
    expect(screen.getByText(/Importe estimado/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pedido|pagar|pago|comprar/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /pedido|pagar|pago/i })).toBeNull();
  });

  it("mientras carga muestra el estado de carga", () => {
    m.obtenerCarrito.mockReturnValue(new Promise(() => {}));
    render(<CarritoVista />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando");
  });

  it("un carrito vacío muestra un mensaje y un enlace al catálogo (CA-F9)", async () => {
    m.obtenerCarrito.mockResolvedValue(carritoVacio());
    render(<CarritoVista />);
    expect(await screen.findByText("Su carrito está vacío.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver el catálogo" })).toHaveAttribute("href", "/catalogo");
  });

  it("un error de carga se informa y «Reintentar» vuelve a consultar", async () => {
    m.obtenerCarrito.mockRejectedValueOnce(new ErrorApi(0, "No se pudo conectar con el servidor.")).mockResolvedValueOnce(carritoTresPuestos());
    render(<CarritoVista />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo conectar");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.getAllByRole("region")).toHaveLength(3));
    expect(m.obtenerCarrito).toHaveBeenCalledTimes(2);
  });
});

describe("CarritoVista · resumen lateral (spec 004, CA-CAR-01, CA-CAR-04)", () => {
  it("muestra productos, puestos, el subtotal de cada puesto y el total tal como llegan, sin pedido ni pago", async () => {
    m.obtenerCarrito.mockResolvedValue(carritoTresPuestos());
    render(<CarritoVista />);
    await screen.findAllByRole("region");
    expect(screen.getAllByRole("region")).toHaveLength(3); // el resumen no es un grupo
    const resumen = screen.getByRole("complementary", { name: "Resumen del carrito" });
    expect(within(resumen).getByText("3 productos · 3 puestos")).toBeInTheDocument();
    const filas = within(within(resumen).getByRole("list", { name: "Subtotales por puesto" })).getAllByRole("listitem");
    expect(filas.map((f) => f.textContent)).toEqual(["A-1 · Puesto AS/ 19.50", "B-1 · Puesto BS/ 0.30", "C-1 · Puesto CS/ 59.97"]);
    expect(within(resumen).getByText(/^Total:/)).toHaveTextContent("Total: S/ 79.77");
    expect(within(resumen).getByText(/Importe estimado/)).toBeInTheDocument();
    expect(within(resumen).getByRole("link", { name: "Seguir comprando" })).toHaveAttribute("href", "/catalogo");
    expect(within(resumen).queryAllByRole("button")).toHaveLength(0);
  });

  it("con un solo puesto no repite su subtotal en el resumen", async () => {
    const uno = carritoTresPuestos();
    uno.puestos = uno.puestos.slice(0, 1);
    uno.total = "19.50";
    m.obtenerCarrito.mockResolvedValue(uno);
    render(<CarritoVista />);
    const resumen = await screen.findByRole("complementary", { name: "Resumen del carrito" });
    expect(within(resumen).queryByRole("list")).toBeNull();
    expect(within(resumen).getByText("1 producto · 1 puesto")).toBeInTheDocument();
  });
});

describe("CarritoVista · modificar, quitar y vaciar (CA-F4, CA-F5)", () => {
  it("tras actualizar, subtotales y total pasan a ser los de la nueva respuesta", async () => {
    m.obtenerCarrito.mockResolvedValue(carritoTresPuestos());
    const nuevo = carritoTresPuestos();
    nuevo.puestos[0]!.items[0] = linea({ productoId: "m", nombre: "Mango", cantidad: 10, subtotal: "65.00" });
    nuevo.puestos[0]!.subtotal = "65.00";
    nuevo.total = "125.27";
    m.actualizarCantidadCarrito.mockResolvedValue(nuevo);
    render(<CarritoVista />);
    await screen.findAllByRole("region");
    const campo = screen.getByLabelText("Cantidad de Mango");
    await userEvent.clear(campo);
    await userEvent.type(campo, "10");
    await userEvent.click(within(screen.getAllByRole("region")[0]!).getByRole("button", { name: "Actualizar" }));
    expect(await screen.findByText("Subtotal del puesto: S/ 65.00")).toBeInTheDocument();
    expect(screen.getByText("S/ 125.27")).toBeInTheDocument();
    expect(m.actualizarCantidadCarrito).toHaveBeenCalledWith("m", 10);
  });

  it("quitar el último producto de un puesto hace desaparecer su grupo", async () => {
    m.obtenerCarrito.mockResolvedValue(carritoTresPuestos());
    const nuevo = carritoTresPuestos();
    nuevo.puestos = nuevo.puestos.slice(1);
    nuevo.total = "60.27";
    m.quitarDelCarrito.mockResolvedValue(nuevo);
    render(<CarritoVista />);
    await screen.findAllByRole("region");
    await userEvent.click(within(screen.getAllByRole("region")[0]!).getByRole("button", { name: "Quitar" }));
    await waitFor(() => expect(screen.getAllByRole("region")).toHaveLength(2));
    expect(screen.queryByRole("heading", { name: `${PUESTOS.A.codigo} · ${PUESTOS.A.nombre}` })).toBeNull();
    expect(screen.getByText("S/ 60.27")).toBeInTheDocument();
  });

  it("quitar el último producto del carrito muestra el estado vacío", async () => {
    const uno = carritoTresPuestos();
    uno.puestos = uno.puestos.slice(0, 1);
    m.obtenerCarrito.mockResolvedValue(uno);
    m.quitarDelCarrito.mockResolvedValue(carritoVacio());
    render(<CarritoVista />);
    await userEvent.click(await screen.findByRole("button", { name: "Quitar" }));
    expect(await screen.findByText("Su carrito está vacío.")).toBeInTheDocument();
  });

  it("«Vaciar carrito» pide confirmación; «Cancelar» no envía y «Confirmar» vacía", async () => {
    m.obtenerCarrito.mockResolvedValue(carritoTresPuestos());
    m.vaciarCarrito.mockResolvedValue(carritoVacio());
    render(<CarritoVista />);
    await screen.findAllByRole("region");
    await userEvent.click(screen.getByRole("button", { name: "Vaciar carrito" }));
    expect(screen.getByText("¿Vaciar todo el carrito?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(m.vaciarCarrito).not.toHaveBeenCalled();
    expect(screen.queryByText("¿Vaciar todo el carrito?")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Vaciar carrito" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(m.vaciarCarrito).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Su carrito está vacío.")).toBeInTheDocument();
  });
});

describe("CarritoVista · disponibilidad y errores (CA-F6, CA-F7)", () => {
  const conProblemas = () => {
    const c = carritoTresPuestos();
    c.puestos[0]!.items[0] = linea({ productoId: "m", nombre: "Mango", cantidad: 5, subtotal: "32.50", estado: "STOCK_INSUFICIENTE", disponible: 2 });
    c.puestos[0]!.subtotal = "0.00";
    c.puestos[1]!.puesto = { id: "pz", codigo: null, nombre: null };
    c.puestos[1]!.items[0] = linea({ productoId: "z", nombre: null, precioUnitario: null, subtotal: null, estado: "NO_DISPONIBLE", disponible: 0 });
    c.puestos[1]!.subtotal = "0.00";
    c.total = "59.97";
    c.requiereRevision = true;
    return c;
  };

  it("destaca las líneas no vigentes, rotula el puesto sin datos y avisa que requiere revisión", async () => {
    m.obtenerCarrito.mockResolvedValue(conProblemas());
    render(<CarritoVista />);
    const grupos = await screen.findAllByRole("region");
    expect(within(grupos[0]!).getByText("Quedan 2")).toBeInTheDocument();
    expect(within(grupos[1]!).getByRole("heading", { name: "Puesto no disponible" })).toBeInTheDocument();
    expect(within(grupos[1]!).getByText("Este producto ya no está disponible")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("requieren revisión");
    expect(screen.getByText(/^Total:/)).toHaveTextContent("Total: S/ 59.97"); // el total ya excluye lo no vigente (lo calcula la API)
  });

  it("un carrito vigente no muestra el aviso de revisión", async () => {
    m.obtenerCarrito.mockResolvedValue(carritoTresPuestos());
    render(<CarritoVista />);
    await screen.findAllByRole("region");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("un error al vaciar se muestra y el carrito sigue visible", async () => {
    m.obtenerCarrito.mockResolvedValue(carritoTresPuestos());
    m.vaciarCarrito.mockRejectedValue(new ErrorApi(0, "No se pudo conectar con el servidor."));
    render(<CarritoVista />);
    await screen.findAllByRole("region");
    await userEvent.click(screen.getByRole("button", { name: "Vaciar carrito" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo conectar");
    expect(screen.getAllByRole("region")).toHaveLength(3);
  });

  it("un 401 al vaciar cierra la sesión local y redirige a /login", async () => {
    m.obtenerCarrito.mockResolvedValue(carritoTresPuestos());
    m.vaciarCarrito.mockRejectedValue(new ErrorApi(401, "Autenticación requerida."));
    render(<CarritoVista />);
    await screen.findAllByRole("region");
    await userEvent.click(screen.getByRole("button", { name: "Vaciar carrito" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(m.signOut).toHaveBeenCalled());
    expect(m.replace).toHaveBeenCalledWith("/login");
  });
});
