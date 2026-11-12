/**
 * Apoyo de las pruebas de PostgreSQL del carrito (T003–T005): clientes y productos etiquetados que se eliminan al terminar.
 * SOLO la base local aislada (la guarda vive en `helpers/inventario-db.ts`).
 */
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { Fixtures } from './inventario-db.js';

export class DatosCarrito {
  private usuarios: string[] = [];
  private n = 0;
  constructor(private readonly prisma: PrismaClient, private readonly fx: Fixtures, private readonly tag: string) {}

  /** Cliente (rol CLIENTE) con su identificador. */
  async cliente(): Promise<string> {
    const u = await this.prisma.usuario.create({ data: { email: `${this.tag}-c${++this.n}@prueba.test`, nombres: 'C', apellidos: 'L', rol: 'CLIENTE' } });
    this.usuarios.push(u.id);
    return u.id;
  }

  /** Producto con stock; `publicado` lo hace visible en el catálogo (puesto, comerciante y categoría activos por defecto). */
  async producto(publicado = true, precio?: string) {
    const { productoId, puestoId } = await this.fx.productoConStock(100);
    if (publicado || precio) {
      await this.prisma.producto.update({ where: { id: productoId }, data: { ...(publicado ? { estado: 'PUBLICADO' as const } : {}), ...(precio ? { precio } : {}) } });
    }
    return { productoId, puestoId };
  }

  async items(usuarioId: string) {
    return this.prisma.carritoItem.findMany({ where: { carrito: { usuarioId } }, orderBy: { productoId: 'asc' }, select: { productoId: true, cantidad: true } });
  }

  async limpiar() {
    await this.prisma.carrito.deleteMany({ where: { usuarioId: { in: this.usuarios } } });
    await this.fx.limpiar();
    await this.prisma.usuario.deleteMany({ where: { id: { in: this.usuarios } } });
  }
}
