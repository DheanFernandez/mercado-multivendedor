import { ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import { ErrorDeDominio } from '../domain/errors.js';

const ESTADO_HTTP: Record<string, number> = {
  VALIDACION: HttpStatus.BAD_REQUEST,
  NO_AUTENTICADO: HttpStatus.UNAUTHORIZED,
  PROHIBIDO: HttpStatus.FORBIDDEN,
  NO_ENCONTRADO: HttpStatus.NOT_FOUND,
  CONFLICTO: HttpStatus.CONFLICT,
  SERVICIO_NO_DISPONIBLE: HttpStatus.SERVICE_UNAVAILABLE,
};

/** Traduce los errores de dominio a respuestas HTTP sin filtrar detalles internos. */
@Catch(ErrorDeDominio)
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: ErrorDeDominio, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<{ status(c: number): { json(b: unknown): void } }>();
    const status = ESTADO_HTTP[error.codigo] ?? HttpStatus.INTERNAL_SERVER_ERROR;
    res.status(status).json({ statusCode: status, codigo: error.codigo, mensaje: error.message });
  }
}
