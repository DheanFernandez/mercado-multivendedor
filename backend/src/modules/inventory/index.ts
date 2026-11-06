/** API pública del módulo Inventario: lo único que otros módulos pueden importar. */
export {
  ConfirmarVentaReservada,
  ConsultarDisponibilidad,
  ExpirarReservasVencidas,
  LiberarReserva,
  ReservarInventario,
} from './application/use-cases/inventario.use-cases.js';
