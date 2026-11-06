import { Rol, type Actor } from '../../../../shared/domain/actor.js';
import { ErrorDeValidacion, ErrorProhibido } from '../../../../shared/domain/errors.js';
import { esUuid } from '../../../../shared/application/paginacion.js';
import { calcularCarrito, cantidadDeItem, MAX_ITEMS_CARRITO, type CarritoCalculado } from '../../domain/calculo.js';
import { ItemNoEncontradoError, LimiteItemsCarritoError, ProductoNoDisponibleError, StockInsuficienteCarritoError } from '../../domain/errors.js';
import type { CarritoRepository, DisponibilidadPort, ProductoVendiblePort } from '../ports/ports.js';

/** El carrito es del cliente: ningún otro rol compra. */
function exigirCliente(actor: Actor): string {
  if (actor.rol !== Rol.CLIENTE) throw new ErrorProhibido('Solo los clientes pueden usar el carrito.');
  return actor.id;
}
function exigirProducto(id: unknown): string {
  if (!esUuid(id)) throw new ErrorDeValidacion('El producto no es válido.');
  return id;
}

export interface DependenciasCarrito {
  carrito: CarritoRepository;
  productos: ProductoVendiblePort;
  inventario: DisponibilidadPort;
}

/** RF20–RF23, HU04, HU06: carrito del cliente con precios y disponibilidad vigentes, agrupado por puesto. */
export class ConsultarCarrito {
  constructor(private readonly d: DependenciasCarrito) {}

  async ejecutar(actor: Actor): Promise<CarritoCalculado> {
    const usuarioId = exigirCliente(actor);
    const items = await this.d.carrito.listar(usuarioId);
    const lineas = await Promise.all(
      items.map(async (i) => {
        const producto = await this.d.productos.obtener(i.productoId);
        return { ...i, producto, disponible: producto ? await this.d.inventario.disponible(i.productoId) : 0 };
      }),
    );
    return calcularCarrito(lineas);
  }
}

/** RF20, RF21, RF15, HU04: agrega (o suma) un producto de cualquier puesto, validando publicación y stock. */
export class AgregarAlCarrito {
  constructor(private readonly d: DependenciasCarrito, private readonly consultar: ConsultarCarrito) {}

  async ejecutar(actor: Actor, c: { productoId?: unknown; cantidad?: unknown }): Promise<CarritoCalculado> {
    const usuarioId = exigirCliente(actor);
    const productoId = exigirProducto(c.productoId);
    const cantidad = cantidadDeItem(c.cantidad);
    const producto = await this.d.productos.obtener(productoId);
    if (!producto) throw new ProductoNoDisponibleError();
    const disponible = await this.d.inventario.disponible(productoId);
    const r = await this.d.carrito.agregar({ usuarioId, productoId, puestoId: producto.puesto.id, cantidad, tope: disponible, maxItems: MAX_ITEMS_CARRITO });
    if (r.resultado === 'SUPERA_TOPE') throw new StockInsuficienteCarritoError(disponible);
    if (r.resultado === 'LIMITE_ITEMS') throw new LimiteItemsCarritoError(MAX_ITEMS_CARRITO);
    return this.consultar.ejecutar(actor);
  }
}

/** RF24, HU05: fija la cantidad de un producto que ya está en el carrito. */
export class ActualizarCantidadCarrito {
  constructor(private readonly d: DependenciasCarrito, private readonly consultar: ConsultarCarrito) {}

  async ejecutar(actor: Actor, productoIdEntrada: unknown, c: { cantidad?: unknown }): Promise<CarritoCalculado> {
    const usuarioId = exigirCliente(actor);
    const productoId = exigirProducto(productoIdEntrada);
    const cantidad = cantidadDeItem(c.cantidad);
    if (!(await this.d.carrito.listar(usuarioId)).some((i) => i.productoId === productoId)) throw new ItemNoEncontradoError();
    if (!(await this.d.productos.obtener(productoId))) throw new ProductoNoDisponibleError();
    const disponible = await this.d.inventario.disponible(productoId);
    if (cantidad > disponible) throw new StockInsuficienteCarritoError(disponible);
    if (!(await this.d.carrito.fijarCantidad({ usuarioId, productoId, cantidad }))) throw new ItemNoEncontradoError();
    return this.consultar.ejecutar(actor);
  }
}

/** RF24, HU05: quita un producto (también uno que ya no esté disponible). */
export class QuitarDelCarrito {
  constructor(private readonly d: DependenciasCarrito, private readonly consultar: ConsultarCarrito) {}

  async ejecutar(actor: Actor, productoIdEntrada: unknown): Promise<CarritoCalculado> {
    const usuarioId = exigirCliente(actor);
    const productoId = exigirProducto(productoIdEntrada);
    if (!(await this.d.carrito.quitar({ usuarioId, productoId }))) throw new ItemNoEncontradoError();
    return this.consultar.ejecutar(actor);
  }
}

export class VaciarCarrito {
  constructor(private readonly d: DependenciasCarrito) {}

  async ejecutar(actor: Actor): Promise<CarritoCalculado> {
    await this.d.carrito.vaciar(exigirCliente(actor));
    return calcularCarrito([]);
  }
}
