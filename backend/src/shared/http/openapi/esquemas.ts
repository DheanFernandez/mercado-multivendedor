import type { ReferenceObject, SchemaObject } from '@nestjs/swagger';

/**
 * Esquemas reutilizables del documento OpenAPI (spec 005). Se describen a mano a partir de las entidades y vistas de cada
 * módulo (`toJSON()`, `vistaProducto`, `ProductoCatalogo`, `CarritoCalculado`); no importan ningún módulo. Véase spec §6.
 */
export const ref = (nombre: string): ReferenceObject => ({ $ref: `#/components/schemas/${nombre}` });

const uuid: SchemaObject = { type: 'string', format: 'uuid' };
const fecha: SchemaObject = { type: 'string', format: 'date-time' };
const importe: SchemaObject = { type: 'string', pattern: '^\\d+\\.\\d{2}$', description: 'Importe en soles con dos decimales, como texto exacto.', example: '12.50' };
const nulable = (s: SchemaObject): SchemaObject => ({ ...s, nullable: true });

const ROLES = ['CLIENTE', 'COMERCIANTE', 'TRABAJADOR_PUESTO', 'ADMINISTRADOR'];
const UNIDADES = ['UNIDAD', 'KILOGRAMO', 'GRAMO', 'LITRO', 'DOCENA', 'MANOJO', 'PAQUETE'];
const ESTADOS_PRODUCTO = ['BORRADOR', 'PUBLICADO', 'DESACTIVADO'];

/** Envoltorio de las listas paginadas por página (`pagina`/`limite`). */
const paginado = (item: string): SchemaObject => ({
  type: 'object',
  required: ['datos', 'pagina', 'limite', 'total', 'totalPaginas'],
  properties: {
    datos: { type: 'array', items: ref(item) },
    pagina: { type: 'integer', minimum: 1 },
    limite: { type: 'integer', minimum: 1 },
    total: { type: 'integer', minimum: 0 },
    totalPaginas: { type: 'integer', minimum: 0 },
  },
});

export const ESQUEMAS: Record<string, SchemaObject> = {
  Error: {
    type: 'object',
    description: 'Error de negocio o de seguridad traducido por el filtro global (`DomainErrorFilter`).',
    required: ['statusCode', 'codigo', 'mensaje'],
    properties: {
      statusCode: { type: 'integer', enum: [400, 401, 403, 404, 409, 503] },
      codigo: { type: 'string', enum: ['VALIDACION', 'NO_AUTENTICADO', 'PROHIBIDO', 'NO_ENCONTRADO', 'CONFLICTO', 'SERVICIO_NO_DISPONIBLE'] },
      mensaje: { type: 'string' },
    },
  },
  ErrorNest: {
    type: 'object',
    description: 'Error estándar de NestJS: lo produce `ParseUUIDPipe` cuando un identificador de la ruta no es un UUID.',
    required: ['statusCode', 'message'],
    properties: {
      statusCode: { type: 'integer', example: 400 },
      message: { type: 'string', example: 'Validation failed (uuid is expected)' },
      error: { type: 'string', example: 'Bad Request' },
    },
  },

  Usuario: {
    type: 'object',
    description: 'Usuario, sin el identificador interno de Supabase Auth (no se expone).',
    required: ['id', 'email', 'nombres', 'apellidos', 'telefono', 'rol', 'estado', 'creadoEn'],
    properties: {
      id: uuid,
      email: { type: 'string', format: 'email' },
      nombres: { type: 'string' },
      apellidos: { type: 'string' },
      telefono: nulable({ type: 'string' }),
      rol: { type: 'string', enum: ROLES },
      estado: { type: 'string', enum: ['ACTIVO', 'INACTIVO'] },
      creadoEn: fecha,
    },
  },
  Comerciante: {
    type: 'object',
    required: ['id', 'usuarioId', 'nombreComercial', 'estado', 'creadoEn'],
    properties: { id: uuid, usuarioId: uuid, nombreComercial: { type: 'string' }, estado: { type: 'string', enum: ['ACTIVO', 'SUSPENDIDO'] }, creadoEn: fecha },
  },
  Puesto: {
    type: 'object',
    required: ['id', 'comercianteId', 'codigo', 'nombre', 'estado', 'creadoEn'],
    properties: {
      id: uuid,
      comercianteId: uuid,
      codigo: { type: 'string', pattern: '^[A-Z0-9][A-Z0-9-]{0,19}$', example: 'A-12' },
      nombre: { type: 'string' },
      estado: { type: 'string', enum: ['ACTIVO', 'INACTIVO'] },
      creadoEn: fecha,
    },
  },
  PuestoPublico: {
    type: 'object',
    description: 'Vista pública de un puesto operativo (para filtrar el catálogo).',
    required: ['id', 'codigo', 'nombre'],
    properties: { id: uuid, codigo: { type: 'string' }, nombre: { type: 'string' } },
  },
  Categoria: {
    type: 'object',
    required: ['id', 'nombre', 'slug', 'descripcion', 'activa', 'creadoEn'],
    properties: { id: uuid, nombre: { type: 'string' }, slug: { type: 'string', pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' }, descripcion: nulable({ type: 'string' }), activa: { type: 'boolean' }, creadoEn: fecha },
  },

  ImagenProducto: {
    type: 'object',
    required: ['id', 'url', 'textoAlternativo', 'orden'],
    properties: { id: uuid, url: nulable({ type: 'string', format: 'uri', description: 'URL pública, o null si el almacenamiento no está configurado.' }), textoAlternativo: nulable({ type: 'string' }), orden: { type: 'integer', minimum: 0 } },
  },
  Producto: {
    type: 'object',
    description: 'Producto en la vista de gestión del comerciante.',
    required: ['id', 'puestoId', 'categoriaId', 'nombre', 'descripcion', 'precio', 'unidadVenta', 'presentacion', 'estado', 'imagenes', 'creadoEn'],
    properties: {
      id: uuid,
      puestoId: uuid,
      categoriaId: uuid,
      nombre: { type: 'string', maxLength: 150 },
      descripcion: nulable({ type: 'string' }),
      precio: importe,
      unidadVenta: { type: 'string', enum: UNIDADES },
      presentacion: nulable({ type: 'string', maxLength: 100 }),
      estado: { type: 'string', enum: ESTADOS_PRODUCTO },
      imagenes: { type: 'array', maxItems: 5, items: ref('ImagenProducto') },
      creadoEn: fecha,
    },
  },
  ProductoCatalogo: {
    type: 'object',
    description: 'Producto publicado en el catálogo público.',
    required: ['id', 'nombre', 'descripcion', 'precio', 'unidadVenta', 'presentacion', 'categoria', 'puesto', 'imagenes'],
    properties: {
      id: uuid,
      nombre: { type: 'string' },
      descripcion: nulable({ type: 'string' }),
      precio: importe,
      unidadVenta: { type: 'string', enum: UNIDADES },
      presentacion: nulable({ type: 'string' }),
      categoria: { type: 'object', required: ['id', 'nombre', 'slug'], properties: { id: uuid, nombre: { type: 'string' }, slug: { type: 'string' } } },
      puesto: ref('PuestoPublico'),
      imagenes: {
        type: 'array',
        items: {
          type: 'object',
          required: ['url', 'textoAlternativo', 'orden'],
          properties: { url: nulable({ type: 'string', format: 'uri' }), textoAlternativo: nulable({ type: 'string' }), orden: { type: 'integer' } },
        },
      },
    },
  },
  PaginaProductos: paginado('Producto'),
  PaginaCatalogo: paginado('ProductoCatalogo'),

  Existencias: {
    type: 'object',
    required: ['productoId', 'puestoId', 'stockFisico', 'stockReservado', 'stockDisponible'],
    properties: { productoId: uuid, puestoId: uuid, stockFisico: { type: 'integer' }, stockReservado: { type: 'integer' }, stockDisponible: { type: 'integer', description: 'Físico menos reservado.' } },
  },
  MovimientoInventario: {
    type: 'object',
    required: ['id', 'tipo', 'variacionFisica', 'variacionReservada', 'stockFisicoDespues', 'stockReservadoDespues', 'motivo', 'actorId', 'referencia', 'creadoEn'],
    properties: {
      id: uuid,
      tipo: { type: 'string', enum: ['INGRESO', 'DEVOLUCION', 'AJUSTE', 'VENTA', 'RESERVA', 'LIBERACION'] },
      variacionFisica: { type: 'integer' },
      variacionReservada: { type: 'integer' },
      stockFisicoDespues: { type: 'integer' },
      stockReservadoDespues: { type: 'integer' },
      motivo: nulable({ type: 'string' }),
      actorId: nulable(uuid),
      referencia: nulable({ type: 'string' }),
      creadoEn: fecha,
    },
  },
  PaginaExistencias: paginado('Existencias'),
  PaginaMovimientos: paginado('MovimientoInventario'),

  LineaCarrito: {
    type: 'object',
    required: ['productoId', 'nombre', 'unidadVenta', 'presentacion', 'cantidad', 'precioUnitario', 'subtotal', 'estado', 'disponible'],
    properties: {
      productoId: uuid,
      nombre: nulable({ type: 'string' }),
      unidadVenta: nulable({ type: 'string' }),
      presentacion: nulable({ type: 'string' }),
      cantidad: { type: 'integer', minimum: 1 },
      precioUnitario: nulable(importe),
      subtotal: nulable(importe),
      estado: { type: 'string', enum: ['OK', 'NO_DISPONIBLE', 'STOCK_INSUFICIENTE'], description: 'Solo las líneas `OK` suman al subtotal y al total.' },
      disponible: { type: 'integer', minimum: 0, description: 'Unidades disponibles hoy.' },
    },
  },
  GrupoPuesto: {
    type: 'object',
    required: ['puesto', 'items', 'subtotal'],
    properties: {
      puesto: { type: 'object', required: ['id', 'codigo', 'nombre'], properties: { id: uuid, codigo: nulable({ type: 'string' }), nombre: nulable({ type: 'string' }) } },
      items: { type: 'array', items: ref('LineaCarrito') },
      subtotal: importe,
    },
  },
  Carrito: {
    type: 'object',
    description: 'Carrito completo del cliente. Precio y disponibilidad se leen vigentes en cada consulta; el importe es estimado.',
    required: ['puestos', 'total', 'totalProductos', 'requiereRevision'],
    properties: { puestos: { type: 'array', items: ref('GrupoPuesto') }, total: importe, totalProductos: { type: 'integer', minimum: 0 }, requiereRevision: { type: 'boolean' } },
  },

  Saludo: { type: 'string', example: 'Hello World!', description: 'Texto de la plantilla de NestJS; no forma parte del dominio.' },
};
