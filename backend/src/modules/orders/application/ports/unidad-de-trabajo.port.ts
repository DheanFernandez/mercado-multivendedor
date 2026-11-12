/**
 * Límite de transacción de Pedidos (contracts §4). La implementación real delega en el componente compartido de T001
 * (`PrismaService.unidadDeTrabajo`): reintenta el bloque COMPLETO ante errores transitorios (máx. 5 intentos en total)
 * y, agotados, lanza `ErrorServicioNoDisponible`. Los errores no transitorios (dominio, integridad) se propagan sin reintento.
 * Si ya hay una unidad vigente, se une a ella.
 */
export interface UnidadDeTrabajo {
  ejecutar<T>(trabajo: () => Promise<T>): Promise<T>;
}

export const UNIDAD_DE_TRABAJO = Symbol('UNIDAD_DE_TRABAJO');
