/** API pública del módulo Carrito: lo único que otros módulos pueden importar. */
export { ObtenerCarritoParaPedido, VaciarCarritoDelPedido } from './application/use-cases/pedido.use-cases.js';
export type { CarritoParaPedido, LineaParaPedido } from './application/use-cases/pedido.use-cases.js';
