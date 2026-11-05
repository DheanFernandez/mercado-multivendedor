import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorNoAutenticado } from '../../../shared/domain/errors.js';
import { ES_PUBLICA, type PeticionConActor } from '../../../shared/http/actor.js';
import { AutenticarSolicitud } from '../application/use-cases/autenticar-solicitud.use-case.js';

/** Guard global: toda ruta exige `Authorization: Bearer <JWT>` salvo las marcadas con @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AutenticarSolicitud) private readonly autenticar: AutenticarSolicitud,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(ES_PUBLICA, [context.getHandler(), context.getClass()])) return true;
    const req = context.switchToHttp().getRequest<PeticionConActor>();
    const cabecera = req.headers['authorization'];
    const token = typeof cabecera === 'string' ? /^Bearer\s+(\S+)$/i.exec(cabecera)?.[1] : undefined;
    if (!token) throw new ErrorNoAutenticado('Autenticación requerida.');
    req.actor = await this.autenticar.ejecutar(token);
    return true;
  }
}
