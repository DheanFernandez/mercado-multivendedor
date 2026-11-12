import { ErrorServicioNoDisponible } from '../../../../shared/domain/errors.js';

/** Límite técnico documentado de la duración de la reserva (research D6): 1 … 99 999 999 minutos. */
export const MAX_DURACION_RESERVA_MINUTOS = 99_999_999;

/** La duración de la reserva falta o no es válida: no se crea nada (503, FR-028 · CA-O24). */
export class ConfiguracionReservaNoDisponibleError extends ErrorServicioNoDisponible {
  constructor() {
    super('La configuración de la reserva de pedidos no está disponible.');
  }
}

/**
 * Duración de la reserva en minutos (contracts §4; FR-028). Sin valor predeterminado: si falta o es inválida lanza
 * `ConfiguracionReservaNoDisponibleError`. Se consulta en cada creación (reemplazable por Configuración operativa, S-04).
 */
export interface ConfiguracionReservaPort {
  duracionMinutos(): number;
}

export const CONFIGURACION_RESERVA_PORT = Symbol('CONFIGURACION_RESERVA_PORT');
