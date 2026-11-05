/** Errores de dominio/aplicación. Son independientes de HTTP; la capa de entrada los traduce. */
export abstract class ErrorDeDominio extends Error {
  abstract readonly codigo: string;
  constructor(mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}
export class ErrorDeValidacion extends ErrorDeDominio {
  readonly codigo = 'VALIDACION';
}
export class ErrorNoAutenticado extends ErrorDeDominio {
  readonly codigo = 'NO_AUTENTICADO';
}
export class ErrorProhibido extends ErrorDeDominio {
  readonly codigo = 'PROHIBIDO';
}
export class ErrorNoEncontrado extends ErrorDeDominio {
  readonly codigo = 'NO_ENCONTRADO';
}
export class ErrorDeConflicto extends ErrorDeDominio {
  readonly codigo = 'CONFLICTO';
}
/** Servicio externo (p. ej. Supabase Auth) no configurado o no disponible. */
export class ErrorServicioNoDisponible extends ErrorDeDominio {
  readonly codigo = 'SERVICIO_NO_DISPONIBLE';
}
