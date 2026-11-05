import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Actor } from '../domain/actor.js';
import { ErrorNoAutenticado } from '../domain/errors.js';

export interface PeticionConActor {
  headers: Record<string, string | string[] | undefined>;
  actor?: Actor;
}

export const ES_PUBLICA = 'esPublica';
/** Marca una ruta como pública. Todas las demás exigen un JWT válido (guard global del módulo auth). */
export const Public = () => SetMetadata(ES_PUBLICA, true);

/** Actor autenticado de la petición (lo establece el guard global; rol y estado vienen de PostgreSQL). */
export const ActorRequerido = createParamDecorator((_d: unknown, ctx: ExecutionContext): Actor => {
  const actor = ctx.switchToHttp().getRequest<PeticionConActor>().actor;
  if (!actor) throw new ErrorNoAutenticado('Autenticación requerida.');
  return actor;
});
