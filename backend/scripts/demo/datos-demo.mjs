/**
 * Datos de DEMOSTRACIÓN del catálogo (spec 004, E2; CA-DEMO-03 a CA-DEMO-05). Solo para la base local `mercado_dev`.
 *
 * - Ficticios y reconocibles: correos en `demo.mercado.test` (dominio reservado .test), puestos con código `DEMO-*` y
 *   comerciantes «(demostración)». Precios referenciales en soles, solo para demostrar.
 * - Claves deterministas: UUID fijos con el prefijo `d3e0000` + grupo, de modo que el seed sea idempotente y la limpieza
 *   borre únicamente estas filas.
 * - Sin cuentas de Supabase ni contraseñas: los comerciantes no tienen `authId` (no pueden iniciar sesión). El cliente de
 *   prueba tiene un `authId` fijo que solo se autentica con un token firmado localmente durante la verificación.
 * - Fotografías (spec §9, E3): cada producto tiene un archivo esperado en `frontend/public/demo/productos/`; el seed solo lo
 *   asocia si existe y es un WebP válido (ver fotos-demo.mjs). Sin archivo, la tarjeta muestra «Sin imagen».
 */
import { archivoFoto, rutaFoto } from './fotos-demo.mjs';

export const PREFIJO_ID = 'd3e0000';
export const DOMINIO_CORREO = 'demo.mercado.test';

/** UUID con formato v4 válido: `d3e0000<grupo>-0000-4000-8000-<n en 12 dígitos>`. */
const uuid = (grupo, n) => `${PREFIJO_ID}${grupo}-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const ID = {
  categoria: (n) => uuid(1, n),
  usuario: (n) => uuid(2, n),
  comerciante: (n) => uuid(3, n),
  puesto: (n) => uuid(4, n),
  producto: (n) => uuid(5, n),
  inventario: (n) => uuid(6, n),
  movimiento: (n) => uuid(7, n),
  imagen: (n) => uuid(8, n),
};

/** Igual que `generarSlug` del dominio de Productos (la prueba lo compara con el original). */
export function generarSlug(nombre) {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const CATEGORIAS_BASE = [
  ['Frutas', 'Frutas de temporada y de todo el año.'],
  ['Verduras', 'Verduras y hortalizas frescas.'],
  ['Tubérculos', 'Papas, camotes y otras raíces.'],
  ['Menestras y granos', 'Lentejas, frejoles y otros granos secos.'],
  ['Abarrotes', 'Arroz, aceite y productos de despensa.'],
  ['Lácteos y huevos', 'Quesos, leche y huevos.'],
  ['Carnes y aves', 'Carnes rojas y aves.'],
  ['Pescados y mariscos', 'Pescado fresco y mariscos del día.'],
];
export const CATEGORIAS = CATEGORIAS_BASE.map(([nombre, descripcion], i) => ({ id: ID.categoria(i + 1), nombre, slug: generarSlug(nombre), descripcion }));
const cat = (nombre) => CATEGORIAS.find((c) => c.nombre === nombre).id;

/** Cuatro comerciantes ficticios, cada uno con un puesto. */
export const PUESTOS = [
  { n: 1, codigo: 'DEMO-A1', nombre: 'Frutería La Cosecha', comercial: 'La Cosecha (demostración)' },
  { n: 2, codigo: 'DEMO-B2', nombre: 'Verduras El Huerto', comercial: 'El Huerto (demostración)' },
  { n: 3, codigo: 'DEMO-C3', nombre: 'Abarrotes El Granero', comercial: 'El Granero (demostración)' },
  { n: 4, codigo: 'DEMO-D4', nombre: 'Carnes y Pescados La Caleta', comercial: 'La Caleta (demostración)' },
].map(({ n, codigo, nombre, comercial }) => ({
  id: ID.puesto(n),
  codigo,
  nombre,
  comerciante: { id: ID.comerciante(n), nombreComercial: comercial },
  usuario: { id: ID.usuario(n), email: `comerciante.${codigo.slice(-2).toLowerCase()}@${DOMINIO_CORREO}`, nombres: 'Comerciante', apellidos: `Demostración ${codigo.slice(-2)}` },
}));
const puesto = (codigo) => PUESTOS.find((p) => p.codigo === codigo);

/** Cliente de prueba: solo existe en `mercado_dev`; su `authId` no corresponde a ninguna cuenta de Supabase. */
export const CLIENTE_PRUEBA = {
  id: ID.usuario(101),
  email: `cliente.prueba@${DOMINIO_CORREO}`,
  nombres: 'Cliente',
  apellidos: 'De Prueba',
  authId: 'd3e000c1-0000-4000-8000-000000000001',
};

// [nombre, precio (S/), unidad, categoría, presentación, descripción, stock inicial]
const PRODUCTOS_POR_PUESTO = {
  'DEMO-A1': [
    ['Palta fuerte', '8.50', 'KILOGRAMO', 'Frutas', null, 'Pulpa cremosa, ideal para ensaladas y sánguches.', 80],
    ['Mango Kent', '6.00', 'KILOGRAMO', 'Frutas', null, 'Dulce y jugoso.', 80],
    ['Plátano de seda', '3.50', 'KILOGRAMO', 'Frutas', null, 'Maduro, para el desayuno.', 100],
    ['Limón sutil', '5.00', 'KILOGRAMO', 'Frutas', null, 'Ácido y aromático, para ceviche y limonada.', 100],
    ['Mandarina', '4.20', 'KILOGRAMO', 'Frutas', null, 'Fácil de pelar.', 90],
  ],
  'DEMO-B2': [
    ['Tomate italiano', '4.20', 'KILOGRAMO', 'Verduras', null, 'Firme, para ensaladas y salsas.', 100],
    ['Cebolla roja', '3.00', 'KILOGRAMO', 'Verduras', null, 'Para sarza y aderezos.', 120],
    ['Culantro', '1.00', 'MANOJO', 'Verduras', 'Manojo mediano', 'Hojas frescas.', 60],
    ['Papa amarilla', '3.80', 'KILOGRAMO', 'Tubérculos', null, 'Harinosa, para purés y causa.', 150],
    ['Camote amarillo', '2.80', 'KILOGRAMO', 'Tubérculos', null, 'Dulce, para acompañar.', 100],
  ],
  'DEMO-C3': [
    ['Lenteja bebé', '7.50', 'KILOGRAMO', 'Menestras y granos', null, 'Grano pequeño de cocción rápida.', 60],
    ['Frejol canario', '9.00', 'KILOGRAMO', 'Menestras y granos', null, 'Grano cremoso.', 60],
    ['Arroz extra', '4.60', 'KILOGRAMO', 'Abarrotes', null, 'Grano largo.', 200],
    ['Aceite vegetal', '9.90', 'LITRO', 'Abarrotes', 'Botella de 1 L', null, 50],
    ['Huevos rosados', '7.00', 'DOCENA', 'Lácteos y huevos', 'Bandeja de 12 unidades', null, 40],
    ['Queso fresco', '18.00', 'KILOGRAMO', 'Lácteos y huevos', null, 'Suave, de leche de vaca.', 40],
  ],
  'DEMO-D4': [
    ['Pechuga de pollo', '14.50', 'KILOGRAMO', 'Carnes y aves', null, 'Sin hueso.', 60],
    ['Carne de res para guiso', '24.00', 'KILOGRAMO', 'Carnes y aves', null, 'Cortada en cubos.', 40],
    ['Bonito fresco', '12.00', 'KILOGRAMO', 'Pescados y mariscos', null, 'Entero, del día.', 40],
    ['Choros frescos', '8.00', 'DOCENA', 'Pescados y mariscos', null, 'Limpios, para choritos a la chalaca.', 40],
  ],
};

let n = 0;
export const PRODUCTOS = Object.entries(PRODUCTOS_POR_PUESTO).flatMap(([codigo, lista]) =>
  lista.map(([nombre, precio, unidadVenta, categoria, presentacion, descripcion, stock]) => {
    n += 1;
    const p = puesto(codigo);
    return {
      id: ID.producto(n),
      puestoId: p.id,
      categoriaId: cat(categoria),
      nombre,
      precio,
      unidadVenta,
      presentacion,
      descripcion,
      stock,
      inventarioId: ID.inventario(n),
      movimientoId: ID.movimiento(n),
      imagenId: ID.imagen(n),
      archivoFoto: archivoFoto(generarSlug(nombre)),
      rutaFoto: rutaFoto(archivoFoto(generarSlug(nombre))),
      actorId: p.usuario.id,
    };
  }),
);

export const UNIDADES_VENTA = ['UNIDAD', 'KILOGRAMO', 'GRAMO', 'LITRO', 'DOCENA', 'MANOJO', 'PAQUETE'];
export const MOTIVO_INGRESO = 'Stock inicial de demostración';

/** Identificadores por tabla, para el seed y la limpieza. */
export const IDS = {
  categorias: CATEGORIAS.map((c) => c.id),
  usuarios: [...PUESTOS.map((p) => p.usuario.id), CLIENTE_PRUEBA.id],
  comerciantes: PUESTOS.map((p) => p.comerciante.id),
  puestos: PUESTOS.map((p) => p.id),
  productos: PRODUCTOS.map((p) => p.id),
};
