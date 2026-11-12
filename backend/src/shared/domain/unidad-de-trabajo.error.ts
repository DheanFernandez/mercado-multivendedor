/**
 * Error TÉCNICO (no de negocio): una operación que solo tiene sentido dentro de una unidad de trabajo se invocó fuera de ella
 * (p. ej. leer el carrito con bloqueo para crear un pedido). Indica un defecto de programación: no se traduce a una
 * respuesta de dominio sino a un error interno.
 */
export class UnidadDeTrabajoRequeridaError extends Error {
  constructor(operacion: string) {
    super(`«${operacion}» requiere una unidad de trabajo vigente (use \`prisma.unidadDeTrabajo()\`).`);
    this.name = 'UnidadDeTrabajoRequeridaError';
  }
}
