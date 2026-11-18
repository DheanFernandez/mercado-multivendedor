import type { ReferenceObject, SchemaObject } from '@nestjs/swagger';
import { ref } from './esquemas.js';

/**
 * Catálogo declarativo de las 42 rutas funcionales (spec 005). Solo datos: ninguna lógica ni importación de módulos.
 * Los roles son los observados en la matriz AC04 del 2026-11-16; la autorización real vive en los casos de uso.
 * Un cambio de ruta, de parámetros o de `@Public()` sin actualizar este archivo rompe `test/openapi.e2e-spec.ts`.
 */
type Esquema = SchemaObject | ReferenceObject;
export type Metodo = 'get' | 'post' | 'patch' | 'delete';

export interface Operacion {
  /** Identificador estable de la operación (`operationId`). */
  id: string;
  metodo: Metodo;
  /** Ruta tal como la declara Nest (`:id`); el documento la convierte a `{id}`. */
  ruta: string;
  etiqueta: string;
  resumen: string;
  descripcion?: string;
  /** `@Public()`: sin sesión. Por defecto, la ruta exige `Authorization: Bearer`. */
  publica?: boolean;
  /** Roles con acceso según AC04 (texto informativo). */
  roles?: string;
  /** Descripción de cada parámetro de ruta. */
  params?: Record<string, string>;
  /** `true` si el controlador usa `ParseUUIDPipe` en TODOS sus parámetros de ruta (un valor no UUID da el 400 estándar de Nest). */
  pipeUuid?: boolean;
  /** Parámetros de consulta (todos opcionales, recibidos como texto). */
  consulta?: Record<string, string | { descripcion: string; enum?: string[] }>;
  cuerpo?: { descripcion: string; esquema: SchemaObject; multipart?: boolean };
  exito: { codigo: 200 | 201; descripcion: string; esquema: Esquema };
  /** Descripción de los errores de negocio que produce la operación (400 se añade si hay entrada que validar; 401/403/503 en las protegidas; 404 con parámetros de ruta). */
  e400?: string;
  e404?: string;
  e409?: string;
  e503?: string;
}

const arr = (esquema: Esquema): SchemaObject => ({ type: 'array', items: esquema });
const texto = (descripcion: string, extra: SchemaObject = {}): SchemaObject => ({ type: 'string', description: descripcion, ...extra });
const objeto = (propiedades: Record<string, SchemaObject>, requeridos: string[] = [], descripcion?: string): SchemaObject => ({
  type: 'object',
  ...(descripcion ? { description: descripcion } : {}),
  ...(requeridos.length ? { required: requeridos } : {}),
  properties: propiedades,
});

const PAG = { pagina: 'Número de página (entero ≥ 1; por defecto 1).', limite: 'Elementos por página (entero ≥ 1).' };
const DESPL = { limite: 'Máximo de elementos (1–100; por defecto 50).', desplazamiento: 'Elementos a omitir (entero ≥ 0; por defecto 0).' };
const ROLES = ['CLIENTE', 'COMERCIANTE', 'TRABAJADOR_PUESTO', 'ADMINISTRADOR'];
const UNIDADES = ['UNIDAD', 'KILOGRAMO', 'GRAMO', 'LITRO', 'DOCENA', 'MANOJO', 'PAQUETE'];

const ADMIN = 'ADMINISTRADOR';
const COM = 'COMERCIANTE';

export const OPERACIONES: readonly Operacion[] = [
  // ── Sistema ──────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'sistema_raiz', metodo: 'get', ruta: '/', etiqueta: 'Sistema', resumen: 'Saludo de la plantilla de NestJS', publica: true,
    descripcion: 'Ruta raíz heredada de la plantilla del framework. No forma parte del dominio; se documenta porque existe.',
    exito: { codigo: 200, descripcion: 'Texto plano.', esquema: ref('Saludo') },
  },

  // ── Autenticación ────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'auth_registro', metodo: 'post', ruta: '/api/v1/auth/registro', etiqueta: 'Autenticación', resumen: 'Autorregistro de un cliente', publica: true,
    descripcion: 'Crea la cuenta en Supabase Auth y el usuario con rol CLIENTE. Cualquier campo `rol` del cuerpo se ignora. El inicio de sesión, el cierre y la recuperación de contraseña los resuelve el cliente directamente con Supabase Auth, no esta API.',
    cuerpo: {
      descripcion: 'Datos del cliente.',
      esquema: objeto(
        { email: texto('Correo electrónico.', { format: 'email' }), contrasena: texto('Contraseña (la longitud la valida el caso de uso).', { format: 'password', writeOnly: true }), nombres: { type: 'string' }, apellidos: { type: 'string' }, telefono: texto('Opcional.') },
        ['email', 'contrasena', 'nombres', 'apellidos'],
      ),
    },
    exito: { codigo: 201, descripcion: 'Usuario creado.', esquema: ref('Usuario') },
    e400: 'Datos inválidos.', e409: 'El correo o la identidad ya están registrados.', e503: 'El servicio de autenticación no está configurado o no responde.',
  },
  {
    id: 'auth_me', metodo: 'get', ruta: '/api/v1/auth/me', etiqueta: 'Autenticación', resumen: 'Perfil del usuario autenticado',
    descripcion: 'Perfil y rol leídos de PostgreSQL (el rol nunca se toma del token).', roles: 'Cualquier usuario autenticado',
    exito: { codigo: 200, descripcion: 'Perfil.', esquema: ref('Usuario') },
  },

  // ── Usuarios ─────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'usuarios_crear', metodo: 'post', ruta: '/api/v1/usuarios', etiqueta: 'Usuarios', resumen: 'Alta de un usuario con cualquier rol', roles: ADMIN,
    descripcion: 'Envía una invitación de Supabase Auth para que la persona defina su contraseña. Sin `rol`, se crea un CLIENTE.',
    cuerpo: {
      descripcion: 'Datos del usuario.',
      esquema: objeto(
        { email: { type: 'string', format: 'email' }, nombres: { type: 'string' }, apellidos: { type: 'string' }, telefono: { type: 'string', nullable: true }, rol: { type: 'string', enum: ROLES } },
        ['email', 'nombres', 'apellidos'],
      ),
    },
    exito: { codigo: 201, descripcion: 'Usuario creado.', esquema: ref('Usuario') },
    e400: 'Datos inválidos.', e409: 'El correo o la identidad ya están registrados.', e503: 'El servicio de autenticación no responde.',
  },
  {
    id: 'usuarios_listar', metodo: 'get', ruta: '/api/v1/usuarios', etiqueta: 'Usuarios', resumen: 'Listar usuarios', roles: ADMIN, consulta: DESPL,
    exito: { codigo: 200, descripcion: 'Usuarios.', esquema: arr(ref('Usuario')) }, e400: 'Paginación inválida.',
  },
  {
    id: 'usuarios_obtener', metodo: 'get', ruta: '/api/v1/usuarios/:id', etiqueta: 'Usuarios', resumen: 'Consultar un usuario', roles: ADMIN, pipeUuid: true,
    params: { id: 'Identificador del usuario.' }, exito: { codigo: 200, descripcion: 'Usuario.', esquema: ref('Usuario') }, e404: 'El usuario no existe.',
  },
  {
    id: 'usuarios_estado', metodo: 'patch', ruta: '/api/v1/usuarios/:id/estado', etiqueta: 'Usuarios', resumen: 'Activar o desactivar el acceso de un usuario', roles: ADMIN, pipeUuid: true,
    params: { id: 'Identificador del usuario.' },
    cuerpo: { descripcion: 'Nuevo estado.', esquema: objeto({ activo: { type: 'boolean' } }, ['activo']) },
    exito: { codigo: 200, descripcion: 'Usuario actualizado.', esquema: ref('Usuario') }, e400: 'Datos inválidos.', e404: 'El usuario no existe.',
  },
  {
    id: 'usuarios_rol', metodo: 'patch', ruta: '/api/v1/usuarios/:id/rol', etiqueta: 'Usuarios', resumen: 'Cambiar el rol de un usuario', roles: ADMIN, pipeUuid: true,
    descripcion: 'Cambia el rol almacenado en PostgreSQL.', params: { id: 'Identificador del usuario.' },
    cuerpo: { descripcion: 'Nuevo rol.', esquema: objeto({ rol: { type: 'string', enum: ROLES } }, ['rol']) },
    exito: { codigo: 200, descripcion: 'Usuario actualizado.', esquema: ref('Usuario') }, e400: 'Datos inválidos.', e404: 'El usuario no existe.',
  },

  // ── Comerciantes y puestos ───────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'comerciantes_crear', metodo: 'post', ruta: '/api/v1/comerciantes', etiqueta: 'Comerciantes y puestos', resumen: 'Registrar un comerciante', roles: ADMIN,
    cuerpo: { descripcion: 'Usuario que será comerciante y su nombre comercial.', esquema: objeto({ usuarioId: { type: 'string', format: 'uuid' }, nombreComercial: { type: 'string' } }, ['usuarioId', 'nombreComercial']) },
    exito: { codigo: 201, descripcion: 'Comerciante registrado.', esquema: ref('Comerciante') }, e400: 'Datos inválidos.', e404: 'El usuario no existe.', e409: 'El usuario ya es comerciante.',
  },
  {
    id: 'comerciantes_listar', metodo: 'get', ruta: '/api/v1/comerciantes', etiqueta: 'Comerciantes y puestos', resumen: 'Listar comerciantes', roles: ADMIN, consulta: DESPL,
    exito: { codigo: 200, descripcion: 'Comerciantes.', esquema: arr(ref('Comerciante')) }, e400: 'Paginación inválida.',
  },
  {
    id: 'comerciantes_obtener', metodo: 'get', ruta: '/api/v1/comerciantes/:id', etiqueta: 'Comerciantes y puestos', resumen: 'Consultar un comerciante', roles: `${ADMIN}; ${COM} titular`, pipeUuid: true,
    params: { id: 'Identificador del comerciante.' }, exito: { codigo: 200, descripcion: 'Comerciante.', esquema: ref('Comerciante') }, e404: 'El comerciante no existe.',
  },
  {
    id: 'comerciantes_actualizar', metodo: 'patch', ruta: '/api/v1/comerciantes/:id', etiqueta: 'Comerciantes y puestos', resumen: 'Editar el nombre comercial', roles: ADMIN, pipeUuid: true,
    params: { id: 'Identificador del comerciante.' },
    cuerpo: { descripcion: 'Campos a modificar.', esquema: objeto({ nombreComercial: { type: 'string' } }) },
    exito: { codigo: 200, descripcion: 'Comerciante actualizado.', esquema: ref('Comerciante') }, e400: 'Datos inválidos.', e404: 'El comerciante no existe.',
  },
  {
    id: 'comerciantes_estado', metodo: 'patch', ruta: '/api/v1/comerciantes/:id/estado', etiqueta: 'Comerciantes y puestos', resumen: 'Activar o suspender un comerciante', roles: ADMIN, pipeUuid: true,
    params: { id: 'Identificador del comerciante.' },
    cuerpo: { descripcion: 'Nuevo estado (`true` = ACTIVO, `false` = SUSPENDIDO).', esquema: objeto({ activo: { type: 'boolean' } }, ['activo']) },
    exito: { codigo: 200, descripcion: 'Comerciante actualizado.', esquema: ref('Comerciante') }, e400: 'Datos inválidos.', e404: 'El comerciante no existe.',
  },
  {
    id: 'puestos_crear', metodo: 'post', ruta: '/api/v1/puestos', etiqueta: 'Comerciantes y puestos', resumen: 'Registrar un puesto', roles: ADMIN,
    cuerpo: { descripcion: 'Datos del puesto.', esquema: objeto({ comercianteId: { type: 'string', format: 'uuid' }, codigo: { type: 'string', pattern: '^[A-Z0-9][A-Z0-9-]{0,19}$' }, nombre: { type: 'string' } }, ['comercianteId', 'codigo', 'nombre']) },
    exito: { codigo: 201, descripcion: 'Puesto registrado.', esquema: ref('Puesto') }, e400: 'Datos inválidos.', e404: 'El comerciante no existe.', e409: 'El código ya existe o el comerciante está inactivo.',
  },
  {
    id: 'puestos_listar', metodo: 'get', ruta: '/api/v1/puestos', etiqueta: 'Comerciantes y puestos', resumen: 'Listar puestos', roles: `${ADMIN}; ${COM}`,
    descripcion: 'Un comerciante ve solo los de su propio comercio.',
    consulta: { comercianteId: 'Filtra por comerciante (UUID).', ...DESPL },
    exito: { codigo: 200, descripcion: 'Puestos.', esquema: arr(ref('Puesto')) }, e400: 'Filtro o paginación inválidos.',
  },
  {
    id: 'puestos_publicos', metodo: 'get', ruta: '/api/v1/puestos/publicos', etiqueta: 'Comerciantes y puestos', resumen: 'Listar puestos operativos (público)', publica: true,
    descripcion: 'Para filtrar el catálogo por puesto (RF18). Solo expone identificador, código y nombre.',
    consulta: { limite: 'Máximo de elementos (1–100; por defecto 100).', desplazamiento: DESPL.desplazamiento },
    exito: { codigo: 200, descripcion: 'Puestos operativos.', esquema: arr(ref('PuestoPublico')) }, e400: 'Paginación inválida.',
  },
  {
    id: 'puestos_obtener', metodo: 'get', ruta: '/api/v1/puestos/:id', etiqueta: 'Comerciantes y puestos', resumen: 'Consultar un puesto', roles: `${ADMIN}; ${COM} titular`, pipeUuid: true,
    params: { id: 'Identificador del puesto.' }, exito: { codigo: 200, descripcion: 'Puesto.', esquema: ref('Puesto') }, e404: 'El puesto no existe.',
  },
  {
    id: 'puestos_actualizar', metodo: 'patch', ruta: '/api/v1/puestos/:id', etiqueta: 'Comerciantes y puestos', resumen: 'Editar un puesto', roles: ADMIN, pipeUuid: true,
    params: { id: 'Identificador del puesto.' },
    cuerpo: { descripcion: 'Campos a modificar.', esquema: objeto({ codigo: { type: 'string', pattern: '^[A-Z0-9][A-Z0-9-]{0,19}$' }, nombre: { type: 'string' }, comercianteId: { type: 'string', format: 'uuid' } }) },
    exito: { codigo: 200, descripcion: 'Puesto actualizado.', esquema: ref('Puesto') }, e400: 'Datos inválidos.', e404: 'El puesto no existe.', e409: 'El código ya existe.',
  },
  {
    id: 'puestos_estado', metodo: 'patch', ruta: '/api/v1/puestos/:id/estado', etiqueta: 'Comerciantes y puestos', resumen: 'Activar o desactivar un puesto', roles: ADMIN, pipeUuid: true,
    params: { id: 'Identificador del puesto.' },
    cuerpo: { descripcion: 'Nuevo estado (`true` = ACTIVO, `false` = INACTIVO).', esquema: objeto({ activo: { type: 'boolean' } }, ['activo']) },
    exito: { codigo: 200, descripcion: 'Puesto actualizado.', esquema: ref('Puesto') }, e400: 'Datos inválidos.', e404: 'El puesto no existe.',
  },

  // ── Categorías ───────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'categorias_activas', metodo: 'get', ruta: '/api/v1/categorias', etiqueta: 'Categorías', resumen: 'Listar categorías activas (público)', publica: true,
    exito: { codigo: 200, descripcion: 'Categorías activas.', esquema: arr(ref('Categoria')) },
  },
  {
    id: 'categorias_gestion', metodo: 'get', ruta: '/api/v1/categorias/gestion', etiqueta: 'Categorías', resumen: 'Listar todas las categorías, incluidas las inactivas', roles: ADMIN,
    exito: { codigo: 200, descripcion: 'Todas las categorías.', esquema: arr(ref('Categoria')) },
  },
  {
    id: 'categorias_crear', metodo: 'post', ruta: '/api/v1/categorias', etiqueta: 'Categorías', resumen: 'Crear una categoría', roles: ADMIN,
    cuerpo: { descripcion: 'Datos de la categoría; el `slug` se deriva del nombre.', esquema: objeto({ nombre: { type: 'string' }, descripcion: { type: 'string' } }, ['nombre']) },
    exito: { codigo: 201, descripcion: 'Categoría creada.', esquema: ref('Categoria') }, e400: 'Datos inválidos.', e409: 'Ya existe una categoría con ese nombre.',
  },
  {
    id: 'categorias_actualizar', metodo: 'patch', ruta: '/api/v1/categorias/:id', etiqueta: 'Categorías', resumen: 'Editar una categoría', roles: ADMIN, pipeUuid: true,
    params: { id: 'Identificador de la categoría.' },
    cuerpo: { descripcion: 'Campos a modificar (`descripcion: null` la borra).', esquema: objeto({ nombre: { type: 'string' }, descripcion: { type: 'string', nullable: true } }) },
    exito: { codigo: 200, descripcion: 'Categoría actualizada.', esquema: ref('Categoria') }, e400: 'Datos inválidos.', e404: 'La categoría no existe.', e409: 'Ya existe una categoría con ese nombre.',
  },
  {
    id: 'categorias_estado', metodo: 'patch', ruta: '/api/v1/categorias/:id/estado', etiqueta: 'Categorías', resumen: 'Activar o desactivar una categoría', roles: ADMIN, pipeUuid: true,
    params: { id: 'Identificador de la categoría.' },
    cuerpo: { descripcion: 'Nueva disponibilidad.', esquema: objeto({ activa: { type: 'boolean' } }, ['activa']) },
    exito: { codigo: 200, descripcion: 'Categoría actualizada.', esquema: ref('Categoria') }, e400: 'Datos inválidos.', e404: 'La categoría no existe.',
  },

  // ── Productos (gestión) ──────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'productos_crear', metodo: 'post', ruta: '/api/v1/productos', etiqueta: 'Productos', resumen: 'Crear un producto', roles: COM,
    descripcion: 'El producto nace en BORRADOR. El comerciante solo puede crearlo en un puesto propio.',
    cuerpo: {
      descripcion: 'Datos del producto.',
      esquema: objeto(
        {
          puestoId: { type: 'string', format: 'uuid' }, categoriaId: { type: 'string', format: 'uuid' }, nombre: { type: 'string', maxLength: 150 }, descripcion: { type: 'string' },
          precio: { description: 'Importe positivo con hasta dos decimales; el caso de uso acepta texto o número.', oneOf: [{ type: 'string', example: '12.50' }, { type: 'number' }] },
          unidadVenta: { type: 'string', enum: UNIDADES }, presentacion: { type: 'string', maxLength: 100 },
        },
        ['puestoId', 'categoriaId', 'nombre', 'precio', 'unidadVenta'],
      ),
    },
    exito: { codigo: 201, descripcion: 'Producto creado.', esquema: ref('Producto') }, e400: 'Datos inválidos.', e404: 'El puesto o la categoría no existen.', e409: 'La categoría está inactiva o el puesto no está operativo.',
  },
  {
    id: 'productos_listar', metodo: 'get', ruta: '/api/v1/productos', etiqueta: 'Productos', resumen: 'Listar productos de gestión', roles: `${ADMIN}; ${COM}`,
    descripcion: 'Un comerciante ve solo los de sus puestos. El catálogo público está en `/api/v1/catalogo/productos`.',
    consulta: { puestoId: 'Filtra por puesto (UUID).', categoriaId: 'Filtra por categoría (UUID).', estado: { descripcion: 'Filtra por estado de publicación.', enum: ['BORRADOR', 'PUBLICADO', 'DESACTIVADO'] }, ...PAG, limite: 'Elementos por página (1–100).' },
    exito: { codigo: 200, descripcion: 'Página de productos.', esquema: ref('PaginaProductos') }, e400: 'Filtros o paginación inválidos.',
  },
  {
    id: 'productos_obtener', metodo: 'get', ruta: '/api/v1/productos/:id', etiqueta: 'Productos', resumen: 'Consultar un producto', roles: `${ADMIN}; ${COM} titular`, pipeUuid: true,
    params: { id: 'Identificador del producto.' }, exito: { codigo: 200, descripcion: 'Producto.', esquema: ref('Producto') }, e404: 'El producto no existe.',
  },
  {
    id: 'productos_actualizar', metodo: 'patch', ruta: '/api/v1/productos/:id', etiqueta: 'Productos', resumen: 'Editar un producto', roles: `${COM} titular`, pipeUuid: true,
    descripcion: 'Solo se aplican los campos listados; el puesto y el estado no se cambian por aquí.', params: { id: 'Identificador del producto.' },
    cuerpo: {
      descripcion: 'Campos a modificar.',
      esquema: objeto({
        categoriaId: { type: 'string', format: 'uuid' }, nombre: { type: 'string', maxLength: 150 }, descripcion: { type: 'string', nullable: true },
        precio: { oneOf: [{ type: 'string', example: '12.50' }, { type: 'number' }] }, unidadVenta: { type: 'string', enum: UNIDADES }, presentacion: { type: 'string', nullable: true, maxLength: 100 },
      }),
    },
    exito: { codigo: 200, descripcion: 'Producto actualizado.', esquema: ref('Producto') }, e400: 'Datos inválidos.', e404: 'El producto no existe.', e409: 'La categoría está inactiva.',
  },
  {
    id: 'productos_estado', metodo: 'patch', ruta: '/api/v1/productos/:id/estado', etiqueta: 'Productos', resumen: 'Publicar o desactivar un producto', roles: `${COM} titular`, pipeUuid: true,
    params: { id: 'Identificador del producto.' },
    cuerpo: { descripcion: 'Acción a ejecutar.', esquema: objeto({ accion: { type: 'string', enum: ['PUBLICAR', 'DESACTIVAR'] } }, ['accion']) },
    exito: { codigo: 200, descripcion: 'Producto actualizado.', esquema: ref('Producto') }, e400: 'Acción inválida.', e404: 'El producto no existe.', e409: 'Transición de estado no permitida.',
  },
  {
    id: 'productos_imagen_subir', metodo: 'post', ruta: '/api/v1/productos/:id/imagenes', etiqueta: 'Productos', resumen: 'Subir una imagen del producto', roles: `${COM} titular`, pipeUuid: true,
    descripcion: 'Una imagen por solicitud (máximo 5 por producto). Formatos JPEG, PNG o WebP, de hasta 2 MiB; el contenido se comprueba por su firma. Se guarda en el almacenamiento de imágenes.',
    params: { id: 'Identificador del producto.' },
    cuerpo: {
      descripcion: 'Archivo y texto alternativo.', multipart: true,
      esquema: objeto({ archivo: { type: 'string', format: 'binary', description: 'Imagen JPEG, PNG o WebP (máx. 2 MiB).' }, textoAlternativo: { type: 'string', description: 'Opcional.' } }, ['archivo']),
    },
    exito: { codigo: 201, descripcion: 'Producto con la imagen añadida.', esquema: ref('Producto') },
    e400: 'Archivo ausente, vacío, demasiado grande o de un tipo no admitido.', e404: 'El producto no existe.', e409: 'El producto ya tiene el máximo de imágenes.', e503: 'El almacenamiento de imágenes no está configurado o no responde.',
  },
  {
    id: 'productos_imagen_quitar', metodo: 'delete', ruta: '/api/v1/productos/:id/imagenes/:imagenId', etiqueta: 'Productos', resumen: 'Eliminar una imagen del producto', roles: `${COM} titular`, pipeUuid: true,
    params: { id: 'Identificador del producto.', imagenId: 'Identificador de la imagen.' },
    exito: { codigo: 200, descripcion: 'Producto sin la imagen.', esquema: ref('Producto') }, e404: 'El producto o la imagen no existen.', e503: 'El almacenamiento de imágenes no responde.',
  },

  // ── Catálogo público ─────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'catalogo_buscar', metodo: 'get', ruta: '/api/v1/catalogo/productos', etiqueta: 'Catálogo', resumen: 'Buscar productos publicados (público)', publica: true,
    descripcion: 'Solo productos PUBLICADOS de puestos, comerciantes y categorías activos.',
    consulta: {
      q: 'Texto de búsqueda (hasta 100 caracteres).', categoriaId: 'Filtra por categoría (UUID).', puestoId: 'Filtra por puesto (UUID).', precioMin: 'Precio mínimo (importe con hasta dos decimales).', precioMax: 'Precio máximo (importe con hasta dos decimales).',
      orden: { descripcion: 'Criterio de orden.', enum: ['recientes', 'precio_asc', 'precio_desc', 'nombre'] }, ...PAG, limite: 'Elementos por página (1–50).',
    },
    exito: { codigo: 200, descripcion: 'Página de productos publicados.', esquema: ref('PaginaCatalogo') }, e400: 'Filtros, orden o paginación inválidos.',
  },
  {
    id: 'catalogo_detalle', metodo: 'get', ruta: '/api/v1/catalogo/productos/:id', etiqueta: 'Catálogo', resumen: 'Detalle de un producto publicado (público)', publica: true,
    params: { id: 'Identificador del producto.' }, exito: { codigo: 200, descripcion: 'Producto.', esquema: ref('ProductoCatalogo') }, e404: 'El producto no existe o no está publicado.',
  },

  // ── Inventario ───────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'inventario_listar', metodo: 'get', ruta: '/api/v1/inventario', etiqueta: 'Inventario', resumen: 'Listar existencias', roles: `${ADMIN} (lectura); ${COM}`,
    descripcion: 'Un comerciante ve solo las de sus puestos. La reserva de stock es una API interna, no una ruta HTTP.',
    consulta: { puestoId: 'Filtra por puesto (UUID).', ...PAG, limite: 'Elementos por página (1–100).' },
    exito: { codigo: 200, descripcion: 'Página de existencias.', esquema: ref('PaginaExistencias') }, e400: 'Filtro o paginación inválidos.',
  },
  {
    id: 'inventario_producto', metodo: 'get', ruta: '/api/v1/inventario/productos/:productoId', etiqueta: 'Inventario', resumen: 'Existencias de un producto', roles: `${ADMIN} (lectura); ${COM} titular`,
    descripcion: 'Un producto sin existencias registradas devuelve ceros.', params: { productoId: 'Identificador del producto.' },
    exito: { codigo: 200, descripcion: 'Existencias.', esquema: ref('Existencias') }, e404: 'El producto no existe.',
  },
  {
    id: 'inventario_movimientos', metodo: 'get', ruta: '/api/v1/inventario/productos/:productoId/movimientos', etiqueta: 'Inventario', resumen: 'Historial de movimientos de un producto', roles: `${ADMIN} (lectura); ${COM} titular`,
    params: { productoId: 'Identificador del producto.' }, consulta: { ...PAG, limite: 'Elementos por página (1–100).' },
    exito: { codigo: 200, descripcion: 'Página de movimientos.', esquema: ref('PaginaMovimientos') }, e400: 'Paginación inválida.', e404: 'El producto no existe.',
  },
  {
    id: 'inventario_registrar', metodo: 'post', ruta: '/api/v1/inventario/productos/:productoId/movimientos', etiqueta: 'Inventario', resumen: 'Registrar un ingreso, devolución o ajuste', roles: `${COM} titular`,
    descripcion: 'Aplica un delta atómico al stock físico y genera un movimiento. Un AJUSTE puede ser negativo y exige motivo.', params: { productoId: 'Identificador del producto.' },
    cuerpo: {
      descripcion: 'Movimiento manual.',
      esquema: objeto({ tipo: { type: 'string', enum: ['INGRESO', 'DEVOLUCION', 'AJUSTE'] }, cantidad: { type: 'integer', description: 'Entero distinto de cero (|cantidad| ≤ 1 000 000); solo el AJUSTE admite negativos.' }, motivo: { type: 'string', maxLength: 200, description: 'Obligatorio en un AJUSTE.' } }, ['tipo', 'cantidad']),
    },
    exito: { codigo: 201, descripcion: 'Existencias resultantes.', esquema: ref('Existencias') }, e400: 'Tipo, cantidad o motivo inválidos.', e404: 'El producto no existe.', e409: 'El ajuste dejaría el stock físico por debajo del reservado.',
  },

  // ── Carrito ──────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'carrito_obtener', metodo: 'get', ruta: '/api/v1/carrito', etiqueta: 'Carrito', resumen: 'Consultar el carrito', roles: 'CLIENTE',
    descripcion: 'Todas las operaciones del carrito devuelven el carrito completo, agrupado por puesto.', exito: { codigo: 200, descripcion: 'Carrito.', esquema: ref('Carrito') },
  },
  {
    id: 'carrito_agregar', metodo: 'post', ruta: '/api/v1/carrito/items', etiqueta: 'Carrito', resumen: 'Agregar un producto', roles: 'CLIENTE',
    descripcion: 'Si el producto ya está en el carrito, suma la cantidad. No reserva stock.',
    cuerpo: { descripcion: 'Producto y cantidad.', esquema: objeto({ productoId: { type: 'string', format: 'uuid' }, cantidad: { type: 'integer', minimum: 1, maximum: 10000 } }, ['productoId', 'cantidad']) },
    exito: { codigo: 201, descripcion: 'Carrito actualizado.', esquema: ref('Carrito') }, e400: 'Datos inválidos.', e404: 'El producto no está disponible.', e409: 'Stock insuficiente o límite de 50 productos distintos.',
  },
  {
    id: 'carrito_cantidad', metodo: 'patch', ruta: '/api/v1/carrito/items/:productoId', etiqueta: 'Carrito', resumen: 'Fijar la cantidad de un producto', roles: 'CLIENTE',
    params: { productoId: 'Identificador del producto.' },
    cuerpo: { descripcion: 'Nueva cantidad.', esquema: objeto({ cantidad: { type: 'integer', minimum: 1, maximum: 10000 } }, ['cantidad']) },
    exito: { codigo: 200, descripcion: 'Carrito actualizado.', esquema: ref('Carrito') }, e400: 'Datos inválidos.', e404: 'El producto no está en el carrito.', e409: 'Stock insuficiente.',
  },
  {
    id: 'carrito_quitar', metodo: 'delete', ruta: '/api/v1/carrito/items/:productoId', etiqueta: 'Carrito', resumen: 'Quitar un producto', roles: 'CLIENTE',
    params: { productoId: 'Identificador del producto.' }, exito: { codigo: 200, descripcion: 'Carrito actualizado.', esquema: ref('Carrito') }, e404: 'El producto no está en el carrito.',
  },
  {
    id: 'carrito_vaciar', metodo: 'delete', ruta: '/api/v1/carrito', etiqueta: 'Carrito', resumen: 'Vaciar el carrito', roles: 'CLIENTE',
    exito: { codigo: 200, descripcion: 'Carrito vacío.', esquema: ref('Carrito') },
  },
];
