import { Inject, Injectable } from '@nestjs/common';
import { ObtenerResumenUsuario } from '../../../users/application/use-cases/obtener-resumen-usuario.use-case.js';
import type { UsuarioConsultaPort } from '../../application/ports/ports.js';

/** Adaptador hacia la API pública del módulo de usuarios. */
@Injectable()
export class UsuarioConsultaAdapter implements UsuarioConsultaPort {
  constructor(@Inject(ObtenerResumenUsuario) private readonly resumen: ObtenerResumenUsuario) {}

  obtenerResumen(id: string) {
    return this.resumen.ejecutar(id);
  }
}
