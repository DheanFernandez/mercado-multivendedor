import { ErrorDeConflicto, ErrorNoEncontrado } from '../../../shared/domain/errors.js';

/** Respuesta controlada de falta de stock (RF15): la reserva no se confirma. */
export class StockInsuficienteError extends ErrorDeConflicto {
  constructor(readonly productoId?: string) {
    super('No hay stock suficiente para la cantidad solicitada.');
  }
}
/** Un ajuste o salida dejaría el stock físico por debajo de lo ya reservado (o negativo). */
export class StockFisicoInsuficienteError extends ErrorDeConflicto {
  constructor() {
    super('El stock físico no puede quedar por debajo de las unidades reservadas.');
  }
}
export class ProductoNoEncontradoError extends ErrorNoEncontrado {
  constructor() { super('Producto no encontrado.'); }
}
export class ReservaNoEncontradaError extends ErrorNoEncontrado {
  constructor() { super('Reserva no encontrada.'); }
}
/** La misma clave de operación se usó antes con otros productos o cantidades. */
export class ClaveOperacionReutilizadaError extends ErrorDeConflicto {
  constructor() { super('La clave de operación ya se usó con una solicitud distinta.'); }
}
export class ReservaYaLiberadaError extends ErrorDeConflicto {
  constructor() { super('La reserva ya fue liberada y no puede confirmarse.'); }
}
export class ReservaYaConfirmadaError extends ErrorDeConflicto {
  constructor() { super('La reserva ya fue confirmada como venta y no puede liberarse.'); }
}
