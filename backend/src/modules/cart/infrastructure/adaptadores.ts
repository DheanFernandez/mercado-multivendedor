import { Inject, Injectable } from '@nestjs/common';
import { ErrorNoEncontrado } from '../../../shared/domain/errors.js';
import { Precio } from '../../../shared/domain/precio.js';
import { ObtenerDetalleCatalogo } from '../../catalog/index.js';
import { ConsultarDisponibilidad } from '../../inventory/index.js';
import type { DisponibilidadPort, ProductoVendible, ProductoVendiblePort } from '../application/ports/ports.js';

/** Adaptador hacia la API pública del Catálogo: solo lo publicado de puestos y categorías activos es comprable. */
@Injectable()
export class ProductoVendibleAdapter implements ProductoVendiblePort {
  constructor(@Inject(ObtenerDetalleCatalogo) private readonly detalle: ObtenerDetalleCatalogo) {}

  async obtener(productoId: string): Promise<ProductoVendible | null> {
    try {
      const p = await this.detalle.ejecutar(productoId);
      return {
        productoId: p.id,
        nombre: p.nombre,
        unidadVenta: p.unidadVenta,
        presentacion: p.presentacion,
        precioCentimos: Precio.desde(p.precio).centimos,
        puesto: p.puesto,
      };
    } catch (e) {
      if (e instanceof ErrorNoEncontrado) return null;
      throw e;
    }
  }
}

/** Adaptador hacia la API pública de Inventario. */
@Injectable()
export class DisponibilidadAdapter implements DisponibilidadPort {
  constructor(@Inject(ConsultarDisponibilidad) private readonly consultarDisponibilidad: ConsultarDisponibilidad) {}

  disponible(productoId: string) {
    return this.consultarDisponibilidad.ejecutar(productoId);
  }
}
