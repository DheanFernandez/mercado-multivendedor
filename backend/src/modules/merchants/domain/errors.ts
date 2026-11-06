import { ErrorDeConflicto, ErrorDeValidacion, ErrorNoEncontrado } from '../../../shared/domain/errors.js';

export class ComercianteYaRegistradoError extends ErrorDeConflicto {
  constructor() {
    super('El usuario ya tiene un perfil de comerciante.');
  }
}
export class ComercianteNoEncontradoError extends ErrorNoEncontrado {
  constructor() {
    super('Comerciante no encontrado.');
  }
}
export class UsuarioNoEncontradoParaComercianteError extends ErrorNoEncontrado {
  constructor() {
    super('El usuario indicado no existe.');
  }
}
export class UsuarioNoEsComercianteError extends ErrorDeValidacion {
  constructor() {
    super('El usuario debe estar activo y tener el rol COMERCIANTE.');
  }
}
export class ComercianteInactivoError extends ErrorDeConflicto {
  constructor() {
    super('El comerciante no está activo.');
  }
}
export class PuestoNoEncontradoError extends ErrorNoEncontrado {
  constructor() {
    super('Puesto no encontrado.');
  }
}
export class CodigoPuestoDuplicadoError extends ErrorDeConflicto {
  constructor() {
    super('Ya existe un puesto con ese código.');
  }
}
