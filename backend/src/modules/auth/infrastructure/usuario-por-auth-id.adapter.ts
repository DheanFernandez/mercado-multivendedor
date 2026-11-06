import { Inject, Injectable } from '@nestjs/common';
import { ResolverUsuarioPorAuthId } from '../../users/application/use-cases/resolver-usuario-por-auth-id.use-case.js';
import type { UsuarioPorAuthIdPort } from '../application/ports/ports.js';

/** Adaptador hacia la API pública del módulo de usuarios. */
@Injectable()
export class UsuarioPorAuthIdAdapter implements UsuarioPorAuthIdPort {
  constructor(@Inject(ResolverUsuarioPorAuthId) private readonly resolver: ResolverUsuarioPorAuthId) {}

  buscar(authId: string) {
    return this.resolver.ejecutar(authId);
  }
}
