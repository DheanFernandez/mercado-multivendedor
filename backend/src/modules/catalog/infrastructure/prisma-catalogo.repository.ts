import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { db } from '../../../shared/infrastructure/prisma/unidad-de-trabajo.js';
import type { CatalogoDetallesRepository, CatalogoRepository, FiltroCatalogo, ProductoCatalogo } from '../application/ports/catalogo.repository.js';

/** Visibilidad pública: producto publicado, categoría activa, puesto activo y comerciante activo. */
const VISIBLE: Prisma.ProductoWhereInput = {
  estado: 'PUBLICADO',
  categoria: { activa: true },
  puesto: { estado: 'ACTIVO', comerciante: { estado: 'ACTIVO' } },
};

const INCLUIR = {
  categoria: { select: { id: true, nombre: true, slug: true } },
  puesto: { select: { id: true, codigo: true, nombre: true } },
  imagenes: { orderBy: { orden: 'asc' as const } },
} satisfies Prisma.ProductoInclude;

type Fila = Prisma.ProductoGetPayload<{ include: typeof INCLUIR }>;

const aLectura = (f: Fila): ProductoCatalogo => ({
  id: f.id,
  nombre: f.nombre,
  descripcion: f.descripcion,
  precio: f.precio.toFixed(2),
  unidadVenta: f.unidadVenta,
  presentacion: f.presentacion,
  categoria: f.categoria,
  puesto: f.puesto,
  imagenes: f.imagenes.map((i) => ({ ruta: i.ruta, textoAlternativo: i.textoAlternativo, orden: i.orden })),
});

const centimos = (c: number) => new Prisma.Decimal(c).div(100);

@Injectable()
export class PrismaCatalogoRepository implements CatalogoRepository, CatalogoDetallesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async buscar(f: FiltroCatalogo) {
    const and: Prisma.ProductoWhereInput[] = [VISIBLE];
    if (f.categoriaId) and.push({ categoriaId: f.categoriaId });
    if (f.puestoId) and.push({ puestoId: f.puestoId });
    if (f.texto) {
      and.push({
        OR: [
          { nombre: { contains: f.texto, mode: 'insensitive' } },
          { descripcion: { contains: f.texto, mode: 'insensitive' } },
          { categoria: { nombre: { contains: f.texto, mode: 'insensitive' } } },
        ],
      });
    }
    if (f.precioMinCentimos !== undefined) and.push({ precio: { gte: centimos(f.precioMinCentimos) } });
    if (f.precioMaxCentimos !== undefined) and.push({ precio: { lte: centimos(f.precioMaxCentimos) } });
    const where: Prisma.ProductoWhereInput = { AND: and };

    const orderBy: Prisma.ProductoOrderByWithRelationInput[] =
      f.orden === 'precio_asc' ? [{ precio: 'asc' }, { id: 'asc' }]
      : f.orden === 'precio_desc' ? [{ precio: 'desc' }, { id: 'asc' }]
      : f.orden === 'nombre' ? [{ nombre: 'asc' }, { id: 'asc' }]
      : [{ creadoEn: 'desc' }, { id: 'asc' }];

    const [filas, total] = await Promise.all([
      this.prisma.producto.findMany({ where, include: INCLUIR, orderBy, take: f.limite, skip: f.desplazamiento }),
      this.prisma.producto.count({ where }),
    ]);
    return { items: filas.map(aLectura), total };
  }

  async detalle(id: string) {
    const fila = await this.prisma.producto.findFirst({ where: { AND: [VISIBLE, { id }] }, include: INCLUIR });
    return fila ? aLectura(fila) : null;
  }

  /**
   * Lectura en lote por la conexión ACTIVA (`db`): dentro de una unidad de trabajo usa su transacción y no abre otra conexión;
   * fuera de ella, el cliente de siempre. Las demás lecturas de este repositorio no cambian.
   */
  async detalles(ids: string[]): Promise<ProductoCatalogo[]> {
    if (ids.length === 0) return [];
    const filas = await db(this.prisma).producto.findMany({ where: { AND: [VISIBLE, { id: { in: ids } }] }, include: INCLUIR });
    return filas.map(aLectura);
  }
}
