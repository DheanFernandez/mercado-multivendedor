/** API pública del módulo Inventario: lo único que otros módulos pueden importar. */
export {
  ConfirmarVentaReservada,
  ConsultarDisponibilidad,
  ExpirarReservasVencidas,
  LiberarReserva,
  ReservarInventario,
} from './application/use-cases/inventario.use-cases.js';
/** Error de falta de stock (trae `productoId`): contrato público para que otros módulos identifiquen el producto sin stock. */
export { StockInsuficienteError } from './domain/errors.js';
