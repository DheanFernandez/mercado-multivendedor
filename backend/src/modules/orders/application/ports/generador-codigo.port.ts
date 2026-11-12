/**
 * Código `PED-` + 8 caracteres (contracts §4; research D5). La implementación real usa aleatoriedad criptográfica
 * (`generarCodigoPedido` del dominio con `crypto.randomInt`); las pruebas inyectan una secuencia para forzar colisiones.
 */
export interface GeneradorCodigoPort {
  generar(): string;
}

export const GENERADOR_CODIGO_PORT = Symbol('GENERADOR_CODIGO_PORT');
