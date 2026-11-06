import type { Rol } from '../../../../shared/domain/actor.js';
import type { Comerciante } from '../../domain/comerciante.entity.js';
import type { Puesto } from '../../domain/puesto.entity.js';

export interface ComercianteRepository {
  /** Crea o actualiza (nombre y estado). @throws ComercianteYaRegistradoError */
  guardar(comerciante: Comerciante): Promise<void>;
  buscarPorId(id: string): Promise<Comerciante | null>;
  buscarPorUsuarioId(usuarioId: string): Promise<Comerciante | null>;
  listar(opciones: { limite: number; desplazamiento: number }): Promise<Comerciante[]>;
}

export interface PuestoRepository {
  /** Crea o actualiza (código, nombre, comerciante y estado). @throws CodigoPuestoDuplicadoError */
  guardar(puesto: Puesto): Promise<void>;
  buscarPorId(id: string): Promise<Puesto | null>;
  /** Puestos activos cuyo comerciante también está activo (visibles para el público). */
  listarOperativos(opciones: { limite: number; desplazamiento: number }): Promise<Puesto[]>;
  listar(opciones: { comercianteId?: string; limite: number; desplazamiento: number }): Promise<Puesto[]>;
}

/** Puerto hacia el módulo de usuarios (el adaptador usa su API pública). */
export interface UsuarioConsultaPort {
  obtenerResumen(id: string): Promise<{ id: string; rol: Rol; activo: boolean } | null>;
}

export const COMERCIANTE_REPOSITORY = Symbol('COMERCIANTE_REPOSITORY');
export const PUESTO_REPOSITORY = Symbol('PUESTO_REPOSITORY');
export const USUARIO_CONSULTA_PORT = Symbol('USUARIO_CONSULTA_PORT');
