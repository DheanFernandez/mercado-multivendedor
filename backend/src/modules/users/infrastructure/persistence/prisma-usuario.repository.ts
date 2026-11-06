import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client.js';
import type { Usuario as UsuarioFila } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service.js';
import type { UsuarioRepository } from '../../application/ports/usuario.repository.js';
import { EmailYaRegistradoError } from '../../domain/errors.js';
import { Usuario } from '../../domain/usuario.entity.js';

const aDominio = (f: UsuarioFila): Usuario =>
  Usuario.reconstruir({
    id: f.id,
    email: f.email,
    nombres: f.nombres,
    apellidos: f.apellidos,
    telefono: f.telefono,
    rol: f.rol,
    estado: f.estado,
    authId: f.authId,
    creadoEn: f.creadoEn,
  });

@Injectable()
export class PrismaUsuarioRepository implements UsuarioRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async guardar(usuario: Usuario): Promise<void> {
    try {
      const mutables = { nombres: usuario.nombres, apellidos: usuario.apellidos, telefono: usuario.telefono, rol: usuario.rol, estado: usuario.estado };
      await this.prisma.usuario.upsert({
        where: { id: usuario.id },
        create: { id: usuario.id, email: usuario.email, authId: usuario.authId, creadoEn: usuario.creadoEn, ...mutables },
        update: mutables, // el correo y el authId no cambian
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new EmailYaRegistradoError();
      throw e;
    }
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    const f = await this.prisma.usuario.findUnique({ where: { id } });
    return f ? aDominio(f) : null;
  }

  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const f = await this.prisma.usuario.findUnique({ where: { email } });
    return f ? aDominio(f) : null;
  }

  async buscarPorAuthId(authId: string): Promise<Usuario | null> {
    const f = await this.prisma.usuario.findUnique({ where: { authId } });
    return f ? aDominio(f) : null;
  }

  async listar({ limite, desplazamiento }: { limite: number; desplazamiento: number }): Promise<Usuario[]> {
    const filas = await this.prisma.usuario.findMany({
      orderBy: [{ creadoEn: 'desc' }, { id: 'asc' }],
      take: limite,
      skip: desplazamiento,
    });
    return filas.map(aDominio);
  }
}
