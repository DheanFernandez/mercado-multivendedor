import { readFileSync } from 'node:fs';
import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPIObject, OperationObject, ParameterObject } from '@nestjs/swagger';
import { describe, expect, it } from 'vitest';
import { construirDocumentoOpenApi } from './documento.js';
import { OPERACIONES } from './operaciones.js';

const documento = construirDocumentoOpenApi();
const METODOS = ['get', 'post', 'patch', 'put', 'delete'] as const;
const operaciones = Object.entries(documento.paths).flatMap(([ruta, item]) =>
  METODOS.filter((m) => item[m]).map((m) => ({ metodo: m, ruta, op: item[m] as OperationObject })),
);
const parametrosRuta = (ruta: string) => [...ruta.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

describe('Documento OpenAPI (spec 005)', () => {
  it('CA-OAS-02 · es OpenAPI 3.x válido y resuelve todas sus referencias', async () => {
    const copia = structuredClone(documento);
    const validado = (await SwaggerParser.validate(copia as never)) as OpenAPIObject;
    expect(validado.openapi).toMatch(/^3\.0\./);
    expect(validado.info.title).toBeTruthy();
    expect(validado.info.version).toBeTruthy();
  });

  it('documenta exactamente 42 operaciones: la raíz y 41 bajo /api/v1, sin identificadores repetidos', () => {
    expect(operaciones).toHaveLength(42);
    expect(OPERACIONES).toHaveLength(42);
    expect(operaciones.filter((o) => o.ruta === '/')).toHaveLength(1);
    expect(operaciones.filter((o) => o.ruta.startsWith('/api/v1/'))).toHaveLength(41);
    const ids = operaciones.map((o) => o.op.operationId);
    expect(new Set(ids).size).toBe(42);
    expect(operaciones.some((o) => o.ruta.includes('docs'))).toBe(false); // las rutas de Swagger no son funcionales (A1)
  });

  it('declara el esquema Bearer y solo las 6 rutas públicas quedan sin seguridad', () => {
    expect(documento.components?.securitySchemes?.['bearerAuth']).toMatchObject({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
    const publicas = operaciones.filter((o) => o.op.security?.length === 0).map((o) => `${o.metodo.toUpperCase()} ${o.ruta}`).sort();
    expect(publicas).toEqual([
      'GET /',
      'GET /api/v1/catalogo/productos',
      'GET /api/v1/catalogo/productos/{id}',
      'GET /api/v1/categorias',
      'GET /api/v1/puestos/publicos',
      'POST /api/v1/auth/registro',
    ]);
    for (const o of operaciones.filter((x) => !publicas.includes(`${x.metodo.toUpperCase()} ${x.ruta}`))) {
      expect(o.op.security, `${o.metodo} ${o.ruta}`).toEqual([{ bearerAuth: [] }]);
    }
  });

  it('CA-OAS-06 · las operaciones con cuerpo lo declaran; GET y DELETE no declaran cuerpo; la subida de imagen es multipart', () => {
    for (const { metodo, ruta, op } of operaciones) {
      if (metodo === 'get' || metodo === 'delete') expect(op.requestBody, `${metodo} ${ruta}`).toBeUndefined();
    }
    const con = operaciones.filter((o) => o.op.requestBody).map((o) => `${o.metodo.toUpperCase()} ${o.ruta}`);
    expect(con).toHaveLength(OPERACIONES.filter((o) => o.cuerpo).length);
    expect(con).toContain('POST /api/v1/carrito/items');
    expect(con).toContain('POST /api/v1/inventario/productos/{productoId}/movimientos');

    const subida = documento.paths['/api/v1/productos/{id}/imagenes']!.post!;
    const contenido = (subida.requestBody as { content: Record<string, { schema: { required?: string[]; properties: Record<string, { type: string; format?: string }> } }> }).content;
    expect(Object.keys(contenido)).toEqual(['multipart/form-data']);
    expect(contenido['multipart/form-data']?.schema.properties['archivo']).toMatchObject({ type: 'string', format: 'binary' });
    expect(contenido['multipart/form-data']?.schema.required).toEqual(['archivo']);
  });

  it('CA-OAS-07 · toda operación declara su éxito real; las protegidas 401, 403 y 503; las que tienen identificador, 404', () => {
    for (const { metodo, ruta, op } of operaciones) {
      const codigos = Object.keys(op.responses);
      const exito = codigos.filter((c) => c.startsWith('2'));
      expect(exito, `${metodo} ${ruta}`).toEqual([metodo === 'post' ? '201' : '200']);
      if (op.security?.length) expect(codigos, `${metodo} ${ruta}`).toEqual(expect.arrayContaining(['401', '403', '503']));
      else expect(codigos, `${metodo} ${ruta}`).not.toContain('401');
      if (parametrosRuta(ruta).length) expect(codigos, `${metodo} ${ruta}`).toContain('404');
      for (const c of codigos.filter((x) => !x.startsWith('2'))) {
        expect(['400', '401', '403', '404', '409', '503']).toContain(c);
        expect(JSON.stringify(op.responses[c])).toMatch(/#\/components\/schemas\/Error/);
      }
    }
  });

  it('los parámetros de ruta del documento son los de su ruta, obligatorios y con UUID donde el controlador usa ParseUUIDPipe', () => {
    for (const { metodo, ruta, op } of operaciones) {
      const deRuta = ((op.parameters ?? []) as ParameterObject[]).filter((p) => p.in === 'path');
      expect(deRuta.map((p) => p.name), `${metodo} ${ruta}`).toEqual(parametrosRuta(ruta));
      for (const p of deRuta) expect(p.required).toBe(true);
    }
    const uuid = (ruta: string, m: 'get' | 'patch') => ((documento.paths[ruta]?.[m]?.parameters ?? []) as ParameterObject[])[0]?.schema;
    expect(uuid('/api/v1/usuarios/{id}', 'get')).toMatchObject({ format: 'uuid' });
    expect(uuid('/api/v1/carrito/items/{productoId}', 'patch')).not.toHaveProperty('format'); // sin ParseUUIDPipe en el controlador
  });

  it('CA-OAS-08 · no contiene datos sensibles: ni authId, ni tokens, ni claves, ni URL de proyectos', () => {
    const texto = JSON.stringify(documento);
    expect(texto).not.toMatch(/authId/);
    expect(texto).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // JWT
    expect(texto).not.toMatch(/sb_(secret|publishable)_/i);
    expect(texto).not.toMatch(/service_role|SUPABASE_|DATABASE_URL|supabase\.co|-----BEGIN/i);
    expect(documento.components?.schemas?.['Usuario']).not.toHaveProperty('properties.authId');
    const registro = documento.paths['/api/v1/auth/registro']?.post?.requestBody as { content: { 'application/json': { schema: { properties: Record<string, { writeOnly?: boolean }> } } } };
    expect(registro.content['application/json'].schema.properties['contrasena']?.writeOnly).toBe(true);
    const respuestas = JSON.stringify(documento.components?.schemas);
    expect(respuestas).not.toMatch(/"contrasena"/); // la contraseña nunca está en un esquema de salida
  });

  it('declara que el contrato no es exhaustivo (CA-OAS-11) y que no hay rutas de Pedidos ni de Pagos', () => {
    expect(documento.info.description).toMatch(/no es exhaustivo/);
    expect(documento.info.description).toMatch(/No hay rutas de Pedidos ni de Pagos/);
    expect(Object.keys(documento.paths).some((p) => /pedido|pago/i.test(p))).toBe(false);
  });

  it('CA-OAS-09 · openapi/openapi.json versionado es idéntico al documento generado y la generación es determinista', () => {
    const generado = `${JSON.stringify(documento, null, 2)}\n`;
    expect(`${JSON.stringify(construirDocumentoOpenApi(), null, 2)}\n`).toBe(generado);
    const versionado = readFileSync(new URL('../../../../openapi/openapi.json', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    expect(versionado, 'regenere con «npm run openapi:exportar»').toBe(generado);
  });
});
