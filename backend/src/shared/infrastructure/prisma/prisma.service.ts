import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client.js';
import type { ClienteTransaccional } from './contexto-transaccional.js';
import { protegerClienteBase } from './resguardo-cliente-base.js';
import { type OpcionesTransaccion, UnidadDeTrabajoPrisma } from './unidad-de-trabajo.js';

/**
 * Cliente de base de datos (infraestructura compartida).
 * Solo debe ser usado por repositorios de la capa de infraestructura de cada módulo;
 * dominio y aplicación dependen de puertos, nunca de PrismaClient (ADR-002).
 *
 * No conecta al arrancar: la conexión es perezosa, de modo que la API inicia sin base de datos.
 *
 * Unidad de trabajo (spec 003-pedidos-subpedidos): `db`, `atomico()` y `unidadDeTrabajo()` permiten que varios
 * repositorios participen de UNA transacción sin pasarse el cliente transaccional. Fuera de una unidad el servicio se
 * comporta exactamente como el `PrismaClient` de siempre; dentro de una unidad, el uso directo del cliente base se rechaza
 * (ver `resguardo-cliente-base.ts`).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly unidad: UnidadDeTrabajoPrisma;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL no está definida (ver backend/.env.example).');
    }
    const adapter = new PrismaPg({
      connectionString,
      max: Number(config.get('DATABASE_POOL_MAX') ?? 10),
    });
    super({ adapter });
    this.unidad = new UnidadDeTrabajoPrisma(this);
    // Dentro de una unidad, usar el cliente base (modelos, consultas crudas, $transaction) falla: use `db` o `atomico()`.
    return protegerClienteBase(this);
  }

  /** Transacción vigente de la unidad de trabajo o, si no hay, este mismo cliente. */
  get db(): ClienteTransaccional | PrismaClient {
    return this.unidad.db;
  }

  /** Se une a la unidad vigente; fuera de ella abre una transacción corta con reintento ante errores transitorios. */
  atomico<T>(trabajo: (tx: ClienteTransaccional) => Promise<T>, opciones?: OpcionesTransaccion): Promise<T> {
    return this.unidad.atomico(trabajo, opciones);
  }

  /** Límite de transacción: reintenta la unidad completa (máx. 5 intentos) solo ante errores transitorios. */
  unidadDeTrabajo<T>(trabajo: () => Promise<T>): Promise<T> {
    return this.unidad.unidadDeTrabajo(trabajo);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
