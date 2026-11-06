import { Inject, Injectable } from '@nestjs/common';
import { ListarIdsPuestosDeTitular, ObtenerPuestoParaProductos } from '../../merchants/index.js';
import type { PuestoConsultaPort } from '../application/ports/ports.js';

/** Adaptador hacia la API pública del módulo Comerciantes y puestos. */
@Injectable()
export class PuestoConsultaAdapter implements PuestoConsultaPort {
  constructor(
    @Inject(ObtenerPuestoParaProductos) private readonly obtenerPuesto: ObtenerPuestoParaProductos,
    @Inject(ListarIdsPuestosDeTitular) private readonly listarIds: ListarIdsPuestosDeTitular,
  ) {}

  obtener(puestoId: string) {
    return this.obtenerPuesto.ejecutar(puestoId);
  }

  idsDeTitular(usuarioId: string) {
    return this.listarIds.ejecutar(usuarioId);
  }
}
