import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import type { Comerciante as ComercianteFila, Puesto as PuestoFila } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service.js';
import type { ComercianteRepository, PuestoRepository } from '../../application/ports/ports.js';
import { Comerciante } from '../../domain/comerciante.entity.js';
import { CodigoPuestoDuplicadoError, ComercianteYaRegistradoError } from '../../domain/errors.js';
import { Puesto } from '../../domain/puesto.entity.js';

const esUnico = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

const comercianteADominio = (f: ComercianteFila) =>
  Comerciante.reconstruir({ id: f.id, usuarioId: f.usuarioId, nombreComercial: f.nombreComercial, estado: f.estado, creadoEn: f.creadoEn });

const puestoADominio = (f: PuestoFila) =>
  Puesto.reconstruir({ id: f.id, comercianteId: f.comercianteId, codigo: f.codigo, nombre: f.nombre, estado: f.estado, creadoEn: f.creadoEn });

@Injectable()
export class PrismaComercianteRepository implements ComercianteRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async guardar(c: Comerciante): Promise<void> {
    try {
      const mutables = { nombreComercial: c.nombreComercial, estado: c.estado };
      await this.prisma.comerciante.upsert({
        where: { id: c.id },
        create: { id: c.id, usuarioId: c.usuarioId, creadoEn: c.toJSON().creadoEn, ...mutables },
        update: mutables, // el titular (usuarioId) no cambia
      });
    } catch (e) {
      if (esUnico(e)) throw new ComercianteYaRegistradoError();
      throw e;
    }
  }

  async buscarPorId(id: string) {
    const f = await this.prisma.comerciante.findUnique({ where: { id } });
    return f ? comercianteADominio(f) : null;
  }

  async buscarPorUsuarioId(usuarioId: string) {
    const f = await this.prisma.comerciante.findUnique({ where: { usuarioId } });
    return f ? comercianteADominio(f) : null;
  }

  async listar({ limite, desplazamiento }: { limite: number; desplazamiento: number }) {
    const filas = await this.prisma.comerciante.findMany({ orderBy: [{ creadoEn: 'desc' }, { id: 'asc' }], take: limite, skip: desplazamiento });
    return filas.map(comercianteADominio);
  }
}

@Injectable()
export class PrismaPuestoRepository implements PuestoRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async guardar(p: Puesto): Promise<void> {
    try {
      const mutables = { comercianteId: p.comercianteId, codigo: p.codigo, nombre: p.nombre, estado: p.estado };
      await this.prisma.puesto.upsert({
        where: { id: p.id },
        create: { id: p.id, creadoEn: p.toJSON().creadoEn, ...mutables },
        update: mutables,
      });
    } catch (e) {
      if (esUnico(e)) throw new CodigoPuestoDuplicadoError();
      throw e;
    }
  }

  async buscarPorId(id: string) {
    const f = await this.prisma.puesto.findUnique({ where: { id } });
    return f ? puestoADominio(f) : null;
  }

  async listarOperativos({ limite, desplazamiento }: { limite: number; desplazamiento: number }) {
    const filas = await this.prisma.puesto.findMany({
      where: { estado: 'ACTIVO', comerciante: { estado: 'ACTIVO' } },
      orderBy: [{ codigo: 'asc' }],
      take: limite,
      skip: desplazamiento,
    });
    return filas.map(puestoADominio);
  }

  async listar({ comercianteId, limite, desplazamiento }: { comercianteId?: string; limite: number; desplazamiento: number }) {
    const filas = await this.prisma.puesto.findMany({
      where: comercianteId ? { comercianteId } : undefined,
      orderBy: [{ codigo: 'asc' }],
      take: limite,
      skip: desplazamiento,
    });
    return filas.map(puestoADominio);
  }
}
