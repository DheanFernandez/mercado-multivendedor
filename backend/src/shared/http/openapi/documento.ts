import type { OpenAPIObject, OperationObject, ParameterObject, PathItemObject, ReferenceObject, ResponsesObject, SchemaObject } from '@nestjs/swagger';
import { ESQUEMAS, ref } from './esquemas.js';
import { OPERACIONES, type Operacion } from './operaciones.js';

/** Versión de la API (prefijo `/api/v1`) documentada por este contrato. */
export const VERSION_API = '1.0.0';

const ETIQUETAS: { name: string; description: string }[] = [
  { name: 'Sistema', description: 'Ruta raíz heredada de la plantilla de NestJS.' },
  { name: 'Autenticación', description: 'Autorregistro y perfil. El inicio de sesión lo resuelve el cliente con Supabase Auth.' },
  { name: 'Usuarios', description: 'Administración de usuarios, estados y roles.' },
  { name: 'Comerciantes y puestos', description: 'Comerciantes, puestos y su consulta pública.' },
  { name: 'Categorías', description: 'Categorías de productos.' },
  { name: 'Productos', description: 'Gestión de productos e imágenes por el comerciante.' },
  { name: 'Catálogo', description: 'Catálogo público de productos publicados.' },
  { name: 'Inventario', description: 'Existencias y movimientos de stock.' },
  { name: 'Carrito', description: 'Carrito multivendedor del cliente.' },
];

const DESCRIPCION = [
  'API REST del monolito modular NestJS de la **Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos** (IS-488 · Sprint 02).',
  '',
  '**Autenticación.** Las rutas protegidas exigen `Authorization: Bearer <JWT de Supabase Auth>`. Las rutas públicas se marcan en el código con `@Public()` y aquí no declaran seguridad. El rol y el estado del usuario se leen de PostgreSQL, nunca del token.',
  '',
  '**Alcance.** Documenta las 42 rutas implementadas en `main`. **No hay rutas de Pedidos ni de Pagos**: esos módulos aún no exponen HTTP.',
  '',
  '**Limitaciones del contrato (no es exhaustivo).** Los cuerpos de entrada se describen a partir de lo que cada controlador lee y no sustituyen la validación de los casos de uso, que puede ser más estricta. Los esquemas de respuesta se describen a mano desde las entidades. Un fallo de la base de datos responde 500 con el cuerpo estándar de NestJS y no se documenta como 503. Los roles son informativos (matriz AC04 del 2026-11-16).',
].join('\n');

const rutaOpenApi = (ruta: string) => ruta.replace(/:(\w+)/g, '{$1}');
const parametrosDeRuta = (ruta: string) => [...ruta.matchAll(/:(\w+)/g)].map((m) => m[1] as string);
const json = (schema: SchemaObject | ReferenceObject) => ({ 'application/json': { schema } });

function parametros(op: Operacion): ParameterObject[] {
  const deRuta = parametrosDeRuta(op.ruta).map<ParameterObject>((nombre) => ({
    name: nombre,
    in: 'path',
    required: true,
    description: op.params?.[nombre] ?? nombre,
    schema: op.pipeUuid ? { type: 'string', format: 'uuid' } : { type: 'string' },
  }));
  const deConsulta = Object.entries(op.consulta ?? {}).map<ParameterObject>(([nombre, d]) => {
    const { descripcion, enum: valores } = typeof d === 'string' ? { descripcion: d, enum: undefined } : d;
    return { name: nombre, in: 'query', required: false, description: descripcion, schema: valores ? { type: 'string', enum: valores } : { type: 'string' } };
  });
  return [...deRuta, ...deConsulta];
}

function respuestas(op: Operacion): ResponsesObject {
  const protegida = !op.publica;
  const r: ResponsesObject = {};
  const contenido = op.id === 'sistema_raiz' ? { 'text/html': { schema: op.exito.esquema } } : json(op.exito.esquema);
  r[String(op.exito.codigo)] = { description: op.exito.descripcion, content: contenido };

  const hayEntrada = Boolean(op.cuerpo) || Boolean(op.consulta) || Boolean(op.pipeUuid);
  if (op.e400 || hayEntrada) {
    r['400'] = {
      description: [op.e400 ?? 'Datos de entrada inválidos.', op.pipeUuid ? 'Un identificador de la ruta que no es un UUID produce el cuerpo estándar de NestJS (`ErrorNest`).' : ''].filter(Boolean).join(' '),
      content: json(op.pipeUuid ? { oneOf: [ref('Error'), ref('ErrorNest')] } : ref('Error')),
    };
  }
  if (protegida) {
    r['401'] = { description: 'Falta el token, es inválido o ha caducado.', content: json(ref('Error')) };
    r['403'] = { description: 'El rol del usuario, o la propiedad del recurso, no permiten la operación.', content: json(ref('Error')) };
  }
  if (op.e404 ?? parametrosDeRuta(op.ruta).length > 0) r['404'] = { description: op.e404 ?? 'El recurso no existe.', content: json(ref('Error')) };
  if (op.e409) r['409'] = { description: op.e409, content: json(ref('Error')) };
  if (protegida || op.e503) {
    const auth = 'El servicio de autenticación no está configurado o no responde.';
    r['503'] = { description: op.e503 && protegida ? `${op.e503} También: ${auth[0]!.toLowerCase()}${auth.slice(1)}` : (op.e503 ?? auth), content: json(ref('Error')) };
  }
  return r;
}

function operacion(op: Operacion): OperationObject {
  const descripcion = [op.descripcion, op.roles ? `**Roles con acceso** (matriz AC04, 2026-11-16): ${op.roles}. La autorización real la aplican los casos de uso.` : undefined].filter(Boolean).join('\n\n');
  const o: OperationObject = {
    operationId: op.id,
    tags: [op.etiqueta],
    summary: op.resumen,
    ...(descripcion ? { description: descripcion } : {}),
    security: op.publica ? [] : [{ bearerAuth: [] }],
    responses: respuestas(op),
  };
  const params = parametros(op);
  if (params.length) o.parameters = params;
  if (op.cuerpo) {
    const tipo = op.cuerpo.multipart ? 'multipart/form-data' : 'application/json';
    o.requestBody = { description: op.cuerpo.descripcion, required: Boolean(op.cuerpo.esquema.required?.length), content: { [tipo]: { schema: op.cuerpo.esquema } } };
  }
  return o;
}

/**
 * Construye el documento OpenAPI de la API (spec 005). Función pura: no crea la aplicación, no usa base de datos ni
 * variables de entorno, y su salida es determinista (se versiona como `backend/openapi/openapi.json`).
 */
export function construirDocumentoOpenApi(): OpenAPIObject {
  const paths: Record<string, PathItemObject> = {};
  for (const op of OPERACIONES) (paths[rutaOpenApi(op.ruta)] ??= {})[op.metodo] = operacion(op);
  return {
    openapi: '3.0.3',
    info: { title: 'Mercado Multivendedor · API REST', version: VERSION_API, description: DESCRIPCION },
    servers: [{ url: '/' }],
    tags: ETIQUETAS,
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT de sesión emitido por Supabase Auth.' } },
      schemas: ESQUEMAS,
    },
  };
}
