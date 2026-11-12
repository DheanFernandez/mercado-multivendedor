import { Inject, Injectable } from '@nestjs/common';
import { UnidadDeTrabajoRequeridaError } from '../../../shared/domain/unidad-de-trabajo.error.js';
import { type ClienteTransaccional, transaccionVigente } from '../../../shared/infrastructure/prisma/contexto-transaccional.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { atomico } from '../../../shared/infrastructure/prisma/unidad-de-trabajo.js';
import type { CarritoRepository, ItemGuardado, ResultadoAgregar } from '../application/ports/ports.js';


/**
 * Carrito sobre PostgreSQL. `agregar` bloquea la fila del carrito del usuario durante la transacción (el upsert del
 * carrito la toma), de modo que las solicitudes simultáneas del mismo cliente se serializan; el tope de stock se
 * comprueba en la misma sentencia que suma, y el CHECK de la tabla es la última barrera.
 *
 * `agregar` usa `atomico()`: fuera de una unidad de trabajo abre su transacción corta con el reintento de siempre; dentro de
 * una unidad se UNE a ella. `bloquearYListar` y `vaciarItems` solo existen dentro de una unidad (conversión del carrito en pedido).
 */
@Injectable()
export class PrismaCarritoRepository implements CarritoRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Transacción de la unidad vigente; las operaciones de lectura con bloqueo solo existen dentro de una unidad. */
  private unidad(operacion: string): ClienteTransaccional {
    const tx = transaccionVigente();
    if (!tx) throw new UnidadDeTrabajoRequeridaError(operacion);
    return tx;
  }

  async listar(usuarioId: string): Promise<ItemGuardado[]> {
    const filas = await this.prisma.carritoItem.findMany({
      where: { carrito: { usuarioId } },
      orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }],
      select: { productoId: true, puestoId: true, cantidad: true },
    });
    return filas;
  }

  agregar(c: { usuarioId: string; productoId: string; puestoId: string; cantidad: number; tope: number; maxItems: number }): Promise<ResultadoAgregar> {
    if (c.cantidad > c.tope) return Promise.resolve({ resultado: 'SUPERA_TOPE' });
    return atomico(this.prisma, async (tx): Promise<ResultadoAgregar> => {
        const [carrito] = await tx.$queryRaw<{ id: string }[]>`
          INSERT INTO carritos (id, usuario_id) VALUES (gen_random_uuid(), ${c.usuarioId}::uuid)
          ON CONFLICT (usuario_id) DO UPDATE SET actualizado_en = now()
          RETURNING id`;
        const carritoId = carrito!.id;

        const [existente] = await tx.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM carrito_items WHERE carrito_id = ${carritoId}::uuid AND producto_id = ${c.productoId}::uuid`;
        if (Number(existente!.n) === 0) {
          const [otros] = await tx.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM carrito_items WHERE carrito_id = ${carritoId}::uuid`;
          if (Number(otros!.n) >= c.maxItems) return { resultado: 'LIMITE_ITEMS' };
        }

        const filas = await tx.$queryRaw<{ cantidad: number }[]>`
          INSERT INTO carrito_items (id, carrito_id, producto_id, puesto_id, cantidad)
          VALUES (gen_random_uuid(), ${carritoId}::uuid, ${c.productoId}::uuid, ${c.puestoId}::uuid, ${c.cantidad}::int)
          ON CONFLICT (carrito_id, producto_id) DO UPDATE
            SET cantidad = carrito_items.cantidad + EXCLUDED.cantidad, actualizado_en = now()
            WHERE carrito_items.cantidad + EXCLUDED.cantidad <= ${c.tope}::int
          RETURNING cantidad`;
        return filas.length === 0 ? { resultado: 'SUPERA_TOPE' } : { resultado: 'AGREGADO', cantidad: filas[0]!.cantidad };
    });
  }

  async fijarCantidad(c: { usuarioId: string; productoId: string; cantidad: number }): Promise<boolean> {
    const n = await this.prisma.$executeRaw`
      UPDATE carrito_items SET cantidad = ${c.cantidad}::int, actualizado_en = now()
      WHERE producto_id = ${c.productoId}::uuid
        AND carrito_id = (SELECT id FROM carritos WHERE usuario_id = ${c.usuarioId}::uuid)`;
    return n > 0;
  }

  async quitar(c: { usuarioId: string; productoId: string }): Promise<boolean> {
    const n = await this.prisma.$executeRaw`
      DELETE FROM carrito_items
      WHERE producto_id = ${c.productoId}::uuid
        AND carrito_id = (SELECT id FROM carritos WHERE usuario_id = ${c.usuarioId}::uuid)`;
    return n > 0;
  }

  async vaciar(usuarioId: string): Promise<void> {
    await this.prisma.$executeRaw`DELETE FROM carrito_items WHERE carrito_id = (SELECT id FROM carritos WHERE usuario_id = ${usuarioId}::uuid)`;
  }

  async bloquearYListar(usuarioId: string): Promise<{ carritoId: string | null; items: ItemGuardado[] }> {
    const tx = this.unidad('bloquearYListar');
    const [carrito] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM carritos WHERE usuario_id = ${usuarioId}::uuid FOR UPDATE`;
    if (!carrito) return { carritoId: null, items: [] };
    // Las filas se bloquean en el orden devuelto (por producto): un orden fijo evita interbloqueos entre unidades.
    const items = await tx.$queryRaw<ItemGuardado[]>`
      SELECT producto_id::text AS "productoId", puesto_id::text AS "puestoId", cantidad
      FROM carrito_items WHERE carrito_id = ${carrito.id}::uuid ORDER BY producto_id FOR UPDATE`;
    return { carritoId: carrito.id, items };
  }

  async vaciarItems(usuarioId: string): Promise<number> {
    const tx = this.unidad('vaciarItems');
    return tx.$executeRaw`DELETE FROM carrito_items WHERE carrito_id = (SELECT id FROM carritos WHERE usuario_id = ${usuarioId}::uuid)`;
  }
}
