import { ErrorDeConflicto, ErrorNoEncontrado } from '../../../shared/domain/errors.js';

export class EmailYaRegistradoError extends ErrorDeConflicto {
  constructor() {
    super('Ya existe un usuario con ese correo electrónico.');
  }
}
export class IdentidadYaExisteError extends ErrorDeConflicto {
  constructor() {
    super('Ya existe una cuenta con ese correo electrónico.');
  }
}
export class UsuarioNoEncontradoError extends ErrorNoEncontrado {
  constructor() {
    super('Usuario no encontrado.');
  }
}
