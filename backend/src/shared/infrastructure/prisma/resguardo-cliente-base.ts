/**
 * Resguardo contra el uso accidental del cliente base de Prisma mientras hay una unidad de trabajo vigente
 * (spec 003-pedidos-subpedidos, R9). Un repositorio que consultara con el cliente base dentro de una unidad abriría una
 * conexión distinta (sin atomicidad y, bajo carga, agotando el pool); aquí eso FALLA de inmediato con
 * `ClienteBaseEnUnidadError`, que además indica qué usar (`db` o `atomico()`).
 *
 * Se envuelve el cliente con un `Proxy` que solo vigila las propiedades que consultan la base de datos: los modelos
 * (`prisma.usuario`, …), las consultas crudas y `$transaction`. Todo lo demás (ciclo de vida, `db`, `atomico()`,
 * `unidadDeTrabajo()`) pasa sin tocar. Fuera de una unidad el comportamiento es idéntico al del cliente sin resguardo.
 */
import { Prisma } from '../../../generated/prisma/client.js';
import { exigirSinUnidadVigente } from './contexto-transaccional.js';

const MODELOS = Object.values(Prisma.ModelName).map((m) => m.charAt(0).toLowerCase() + m.slice(1));
const CONSULTAS = ['$queryRaw', '$queryRawUnsafe', '$executeRaw', '$executeRawUnsafe', '$transaction'];

export const PROPIEDADES_RESGUARDADAS: ReadonlySet<string> = new Set([...MODELOS, ...CONSULTAS]);

export function protegerClienteBase<T extends object>(cliente: T): T {
  return new Proxy(cliente, {
    get(objetivo, propiedad, receptor) {
      if (typeof propiedad === 'string' && PROPIEDADES_RESGUARDADAS.has(propiedad)) exigirSinUnidadVigente(propiedad);
      return Reflect.get(objetivo, propiedad, receptor) as unknown;
    },
  });
}
