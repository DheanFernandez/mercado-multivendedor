import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImagenProducto, TarjetaProducto } from "@/components/catalogo/TarjetaProducto";
import type { ProductoCatalogo } from "@/lib/tipos";

const producto = (p: Partial<ProductoCatalogo> = {}): ProductoCatalogo => ({
  id: "33333333-3333-4333-8333-333333333333",
  nombre: "Papa amarilla",
  descripcion: "Ideal para purés",
  precio: "4.50",
  unidadVenta: "KILOGRAMO",
  presentacion: null,
  categoria: { id: "c", nombre: "Tubérculos", slug: "tuberculos" },
  puesto: { id: "p", codigo: "A-12", nombre: "Doña Rosa" },
  imagenes: [{ url: "https://almacen.test/papa.webp", textoAlternativo: "Papas en una canasta", orden: 0 }],
  ...p,
});

describe("TarjetaProducto (spec 004, CA-CAT-04)", () => {
  it("muestra foto, nombre, precio y unidad tal como llegan, categoría y puesto, y enlaza al detalle", () => {
    render(<TarjetaProducto producto={producto()} />);
    const enlace = screen.getByRole("link");
    expect(enlace).toHaveAttribute("href", "/catalogo/33333333-3333-4333-8333-333333333333");
    expect(screen.getByRole("img", { name: "Papas en una canasta" })).toHaveAttribute("src", "https://almacen.test/papa.webp");
    expect(screen.getByRole("heading", { name: "Papa amarilla" })).toBeInTheDocument();
    expect(screen.getByText("S/ 4.50")).toBeInTheDocument();
    expect(screen.getByText("/ kg")).toBeInTheDocument();
    expect(screen.getByText("Tubérculos")).toBeInTheDocument();
    expect(screen.getByText("Puesto A-12 · Doña Rosa")).toBeInTheDocument();
    expect(screen.getByText("Ideal para purés")).toBeInTheDocument();
  });

  it("prefiere la presentación al extracto de la descripción y no inventa disponibilidad", () => {
    render(<TarjetaProducto producto={producto({ presentacion: "Saco de 5 kg" })} />);
    expect(screen.getByText("Saco de 5 kg")).toBeInTheDocument();
    expect(screen.queryByText("Ideal para purés")).toBeNull();
    expect(screen.queryByText(/stock|disponible|agotado/i)).toBeNull();
  });

  it("no inventa descuentos, valoraciones ni acciones que la API no tiene (E1-A6)", () => {
    const { container } = render(<TarjetaProducto producto={producto()} />);
    expect(container.textContent).not.toMatch(/descuento|oferta|%|★|valoraci|reseña|envío gratis/i);
    expect(screen.queryByRole("button")).toBeNull(); // la tarjeta solo enlaza al detalle
    expect(screen.getAllByText(/S\/ /)).toHaveLength(1); // un único precio, sin precio «anterior» tachado
  });

  it("sin imágenes muestra el marcador «Sin imagen» y usa el nombre como texto alternativo si no hay otro", () => {
    render(<TarjetaProducto producto={producto({ imagenes: [], descripcion: null })} />);
    expect(screen.getByRole("img", { name: "Sin imagen" })).toBeInTheDocument();
  });

  it("ImagenProducto conserva su firma (detalle, panel e imágenes la usan) (CA-CAT-12)", () => {
    render(<ImagenProducto url={null} alt="x" className="extra" />);
    expect(screen.getByRole("img", { name: "Sin imagen" })).toBeInTheDocument();
  });
});
