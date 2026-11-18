/**
 * OpenAPI/Swagger (spec 005): el contrato debe coincidir con las rutas REALES de la aplicación (CA-OAS-01, 03, 04, 05).
 * Aplicación completa con repositorios en memoria; sin base de datos ni Supabase. Las rutas de Swagger no cuentan (A1).
 */
import { type INestApplication, RequestMethod } from '@nestjs/common';
import { DiscoveryService, ModulesContainer } from '@nestjs/core';
import { SwaggerModule, type OperationObject, type ParameterObject } from '@nestjs/swagger';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ES_PUBLICA } from '../src/shared/http/actor.js';
import { construirDocumentoOpenApi } from '../src/shared/http/openapi/documento.js';
import { montarDocumentacionOpenApi } from '../src/shared/http/openapi/montar.js';
import { crearAppEnMemoria } from './helpers/app-en-memoria.js';

const METODOS = ['get', 'post', 'put', 'delete', 'patch'] as const; // orden de RequestMethod
type Operaciones = Map<string, OperationObject>;

const normalizar = (...partes: string[]) => `/${partes.map((p) => p.replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/')}`;
const aOpenApi = (ruta: string) => ruta.replace(/:(\w+)/g, '{$1}');
const parametros = (op: OperationObject | undefined, donde: 'path' | 'query') =>
  ((op?.parameters ?? []) as ParameterObject[]).filter((p) => p.in === donde).map((p) => p.name).sort();
const exito = (op: OperationObject | undefined) => Object.keys(op?.responses ?? {}).filter((c) => c.startsWith('2')).sort();

describe('OpenAPI frente a las rutas reales (HTTP)', () => {
  let app: INestApplication;
  let h: Awaited<ReturnType<typeof crearAppEnMemoria>>;
  const contrato = construirDocumentoOpenApi();
  const reales: Operaciones = new Map();
  const publicas = new Set<string>();
  const documentadas: Operaciones = new Map();

  beforeAll(async () => {
    h = await crearAppEnMemoria((a) => montarDocumentacionOpenApi(a, {}));
    app = h.app;

    // Rutas reales: el explorador de Nest (el mismo que usa Swagger) sobre la aplicación en marcha. Swagger UI no es un controlador.
    const real = SwaggerModule.createDocument(app, { openapi: '3.0.0', info: { title: 'real', version: '0' } });
    for (const [ruta, item] of Object.entries(real.paths)) for (const m of METODOS) if (item[m]) reales.set(`${m.toUpperCase()} ${ruta}`, item[m] as OperationObject);
    for (const [ruta, item] of Object.entries(contrato.paths)) for (const m of METODOS) if (item[m]) documentadas.set(`${m.toUpperCase()} ${ruta}`, item[m] as OperationObject);

    // `@Public()` real, leído del mismo metadato que usa el guard global (handler o clase).
    const descubrimiento = new DiscoveryService(app.get(ModulesContainer));
    for (const w of descubrimiento.getControllers()) {
      const clase = w.metatype as (new (...a: never[]) => unknown) | null;
      if (!clase) continue;
      const base = (Reflect.getMetadata('path', clase) as string | undefined) ?? '';
      for (const nombre of Object.getOwnPropertyNames(clase.prototype)) {
        const handler = (clase.prototype as Record<string, unknown>)[nombre];
        if (typeof handler !== 'function') continue;
        const metodo = Reflect.getMetadata('method', handler) as number | undefined;
        if (metodo === undefined) continue;
        const sub = (Reflect.getMetadata('path', handler) as string | undefined) ?? '/';
        const clave = `${RequestMethod[metodo]} ${aOpenApi(normalizar(base, sub))}`;
        if (Reflect.getMetadata(ES_PUBLICA, handler) || Reflect.getMetadata(ES_PUBLICA, clase)) publicas.add(clave);
      }
    }
  });
  afterAll(async () => app?.close());

  it('CA-OAS-01 · Swagger UI y el documento JSON se sirven sin sesión; el resto de la API sigue exigiéndola', async () => {
    const ui = await request(app.getHttpServer()).get('/api/docs');
    expect(ui.status).toBe(200);
    expect(ui.headers['content-type']).toMatch(/html/);
    expect(ui.text).toMatch(/swagger/i);

    const json = await request(app.getHttpServer()).get('/api/docs-json');
    expect(json.status).toBe(200);
    expect(json.headers['content-type']).toMatch(/json/);
    expect(json.body).toEqual(JSON.parse(JSON.stringify(contrato)));

    expect((await request(app.getHttpServer()).get('/api/v1/carrito')).status).toBe(401);
    expect((await request(app.getHttpServer()).get('/api/v1/categorias')).status).toBe(200);
  });

  it('puede desactivarse con OPENAPI_HABILITADO=false', () => {
    expect(montarDocumentacionOpenApi(app, { OPENAPI_HABILITADO: 'false' })).toBe(false);
  });

  it('CA-OAS-03 · el contrato documenta exactamente las 42 rutas reales, sin faltantes ni sobrantes', () => {
    expect(reales.size).toBe(42);
    expect([...documentadas.keys()].sort()).toEqual([...reales.keys()].sort());
    expect([...reales.keys()].filter((k) => k.endsWith(' /'))).toEqual(['GET /']);
    expect([...reales.keys()].filter((k) => / \/api\/v1\//.test(k))).toHaveLength(41);
    expect([...reales.keys()].some((k) => /\/api\/docs/.test(k))).toBe(false);
  });

  it('CA-OAS-04 · una operación es pública si y solo si su handler o su controlador tienen @Public()', () => {
    expect(publicas.size).toBe(6);
    for (const [clave, op] of documentadas) {
      const sinSeguridad = op.security?.length === 0;
      expect(sinSeguridad, clave).toBe(publicas.has(clave));
      if (!sinSeguridad) expect(op.security, clave).toEqual([{ bearerAuth: [] }]);
    }
    expect([...publicas].every((k) => documentadas.has(k))).toBe(true);
  });

  it('CA-OAS-05 · los parámetros de ruta y de consulta de cada operación son los de su handler', () => {
    for (const [clave, real] of reales) {
      const doc = documentadas.get(clave);
      expect(parametros(doc, 'path'), clave).toEqual(parametros(real, 'path'));
      expect(parametros(doc, 'query'), clave).toEqual(parametros(real, 'query'));
    }
  });

  it('el código de éxito documentado es el que declara el controlador (201 en POST, 200 en el resto)', () => {
    for (const [clave, real] of reales) expect(exito(documentadas.get(clave)), clave).toEqual(exito(real));
  });
});
