import { Inject, Injectable } from '@nestjs/common';
import { ListarIdsPuestosDeTitular, ObtenerPuestoParaProductos } from '../../merchants/index.js';
import { ObtenerPuestoDeProducto } from '../../products/index.js';
import type { PropiedadProductoPort } from '../application/ports/ports.js';

/** Adaptador hacia las APIs públicas de Productos y Comerciantes y puestos. */
@Injectable()
export class PropiedadProductoAdapter implements PropiedadProductoPort {
  constructor(
    @Inject(ObtenerPuestoDeProducto) private readonly puestoDeProducto: ObtenerPuestoDeProducto,
    @Inject(ObtenerPuestoParaProductos) private readonly obtenerPuesto: ObtenerPuestoParaProductos,
    @Inject(ListarIdsPuestosDeTitular) private readonly listarIds: ListarIdsPuestosDeTitular,
  ) {}

  async productoConTitular(productoId: string) {
    const producto = await this.puestoDeProducto.ejecutar(productoId);
    if (!producto) return null;
    const puesto = await this.obtenerPuesto.ejecutar(producto.puestoId);
    return puesto ? { productoId: producto.productoId, puestoId: puesto.id, usuarioIdTitular: puesto.usuarioIdTitular } : null;
  }

  idsPuestoDeTitular(usuarioId: string) {
    return this.listarIds.ejecutar(usuarioId);
  }
}
