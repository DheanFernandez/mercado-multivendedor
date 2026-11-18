import type { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { construirDocumentoOpenApi } from './documento.js';

export const RUTA_DOCUMENTACION = 'api/docs';
export const RUTA_DOCUMENTO_JSON = 'api/docs-json';

/**
 * Sirve Swagger UI (`/api/docs`) y el documento JSON (`/api/docs-json`) a partir del contrato propio (spec 005).
 * Se registran sobre el adaptador HTTP, fuera de los controladores: no pasan por el guard ni cambian ninguna ruta de la API.
 * `OPENAPI_HABILITADO=false` las desactiva (decisión de despliegue del Sprint 03).
 */
export function montarDocumentacionOpenApi(app: INestApplication, entorno: Record<string, string | undefined> = process.env): boolean {
  if (entorno['OPENAPI_HABILITADO']?.trim().toLowerCase() === 'false') return false;
  SwaggerModule.setup(RUTA_DOCUMENTACION, app, construirDocumentoOpenApi(), {
    jsonDocumentUrl: RUTA_DOCUMENTO_JSON,
    yamlDocumentUrl: undefined,
    customSiteTitle: 'Mercado Multivendedor · API',
  });
  return true;
}
