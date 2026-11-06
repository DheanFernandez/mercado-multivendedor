import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import type { Categoria as CategoriaFila, Producto as ProductoFila, ProductoImagen as ImagenFila } from '../../../generated/prisma/client.js';
import { ErrorDeConflicto } from '../../../shared/domain/errors.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import type { CategoriaRepository, FiltroProductos, ProductoRepository } from '../application/ports/ports.js';
import { Categoria } from '../domain/categoria.entity.js';
import { CategoriaDuplicadaError } from '../domain/errors.js';
import { Precio } from '../../../shared/domain/precio.js';
import { Producto } from '../domain/producto.entity.js';

const esUnico = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

const categoriaADominio = (f: CategoriaFila) =>
  Categoria.reconstruir({ id: f.id, nombre: f.nombre, slug: f.slug, descripcion: f.descripcion, activa: f.activa, creadoEn: f.creadoEn });

const productoADominio = (f: ProductoFila & { imagenes: ImagenFila[] }) =>
  Producto.reconstruir({
    id: f.id,
    puestoId: f.puestoId,
    categoriaId: f.categoriaId,
    nombre: f.nombre,
    descripcion: f.descripcion,
    precio: Precio.desde(f.precio.toFixed(2)),
    unidadVenta: f.unidadVenta,
    presentacion: f.presentacion,
    estado: f.estado,
    imagenes: [...f.imagenes].sort((a, b) => a.orden - b.orden).map((i) => ({ id: i.id, ruta: i.ruta, textoAlternativo: i.textoAlternativo, orden: i.orden })),
    creadoEn: f.creadoEn,
  });

@Injectable()
export class PrismaCategoriaRepository implements CategoriaRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async guardar(c: Categoria): Promise<void> {
    const datos = { nombre: c.nombre, slug: c.slug, descripcion: c.descripcion, activa: c.activa };
    try {
      await this.prisma.categoria.upsert({ where: { id: c.id }, create: { id: c.id, creadoEn: c.toJSON().creadoEn, ...datos }, update: datos });
    } catch (e) {
      if (esUnico(e)) throw new CategoriaDuplicadaError();
      throw e;
    }
  }

  async buscarPorId(id: string) {
    const f = await this.prisma.categoria.findUnique({ where: { id } });
    return f ? categoriaADominio(f) : null;
  }

  async listar({ soloActivas }: { soloActivas: boolean }) {
    const filas = await this.prisma.categoria.findMany({ where: soloActivas ? { activa: true } : undefined, orderBy: { nombre: 'asc' } });
    return filas.map(categoriaADominio);
  }
}

@Injectable()
export class PrismaProductoRepository implements ProductoRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async guardar(p: Producto): Promise<void> {
    const datos = {
      categoriaId: p.categoriaId,
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: new Prisma.Decimal(p.precio.toString()),
      unidadVenta: p.unidadVenta,
      presentacion: p.presentacion,
      estado: p.estado,
    };
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.producto.upsert({
          where: { id: p.id },
          create: { id: p.id, puestoId: p.puestoId, creadoEn: p.creadoEn, ...datos },
          update: datos, // el puesto nunca se modifica
        });
        const imagenes = p.imagenes;
        await tx.productoImagen.deleteMany({ where: { productoId: p.id, id: { notIn: imagenes.map((i) => i.id) } } });
        for (const i of imagenes) {
          await tx.productoImagen.upsert({
            where: { id: i.id },
            create: { id: i.id, productoId: p.id, ruta: i.ruta, textoAlternativo: i.textoAlternativo, orden: i.orden },
            update: { textoAlternativo: i.textoAlternativo, orden: i.orden },
          });
        }
      });
    } catch (e) {
      if (esUnico(e)) throw new ErrorDeConflicto('El producto fue modificado simultáneamente. Inténtelo de nuevo.');
      throw e;
    }
  }

  async buscarPorId(id: string) {
    const f = await this.prisma.producto.findUnique({ where: { id }, include: { imagenes: true } });
    return f ? productoADominio(f) : null;
  }

  async listar(f: FiltroProductos) {
    const where: Prisma.ProductoWhereInput = {
      ...(f.puestoId ? { puestoId: f.puestoId } : f.puestoIds ? { puestoId: { in: f.puestoIds } } : {}),
      ...(f.categoriaId ? { categoriaId: f.categoriaId } : {}),
      ...(f.estado ? { estado: f.estado } : {}),
    };
    const [filas, total] = await Promise.all([
      this.prisma.producto.findMany({ where, include: { imagenes: true }, orderBy: [{ creadoEn: 'desc' }, { id: 'asc' }], take: f.limite, skip: f.desplazamiento }),
      this.prisma.producto.count({ where }),
    ]);
    return { items: filas.map(productoADominio), total };
  }
}
