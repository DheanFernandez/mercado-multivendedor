/** Hora actual (contracts §4). Inyectable para pruebas deterministas. */
export interface RelojPort {
  ahora(): Date;
}

export const RELOJ_PORT = Symbol('RELOJ_PORT');
