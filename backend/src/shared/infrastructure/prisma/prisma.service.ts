import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client.js';

/**
 * Cliente de base de datos (infraestructura compartida).
 * Solo debe ser usado por repositorios de la capa de infraestructura de cada módulo;
 * dominio y aplicación dependen de puertos, nunca de PrismaClient (ADR-002).
 *
 * No conecta al arrancar: la conexión es perezosa, de modo que la API inicia sin base de datos.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
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
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
