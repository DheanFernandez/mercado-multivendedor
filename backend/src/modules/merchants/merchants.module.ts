import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import {
  COMERCIANTE_REPOSITORY,
  PUESTO_REPOSITORY,
  USUARIO_CONSULTA_PORT,
  type ComercianteRepository,
  type PuestoRepository,
  type UsuarioConsultaPort,
} from './application/ports/ports.js';
import { ConsultarComerciante, ListarComerciantes, RegistrarComerciante } from './application/use-cases/comerciantes.use-cases.js';
import { ListarPuestos, RegistrarPuesto } from './application/use-cases/puestos.use-cases.js';
import { ComerciantesController } from './entry-adapters/controllers/comerciantes.controller.js';
import { UsuarioConsultaAdapter } from './infrastructure/adapters/usuario-consulta.adapter.js';
import { PrismaComercianteRepository, PrismaPuestoRepository } from './infrastructure/persistence/prisma-merchants.repositories.js';

/** Raíz de composición del módulo Comerciantes y puestos. */
@Module({
  imports: [UsersModule],
  controllers: [ComerciantesController],
  providers: [
    { provide: COMERCIANTE_REPOSITORY, useClass: PrismaComercianteRepository },
    { provide: PUESTO_REPOSITORY, useClass: PrismaPuestoRepository },
    { provide: USUARIO_CONSULTA_PORT, useClass: UsuarioConsultaAdapter },
    {
      provide: RegistrarComerciante,
      useFactory: (c: ComercianteRepository, u: UsuarioConsultaPort) => new RegistrarComerciante(c, u),
      inject: [COMERCIANTE_REPOSITORY, USUARIO_CONSULTA_PORT],
    },
    { provide: ConsultarComerciante, useFactory: (c: ComercianteRepository) => new ConsultarComerciante(c), inject: [COMERCIANTE_REPOSITORY] },
    { provide: ListarComerciantes, useFactory: (c: ComercianteRepository) => new ListarComerciantes(c), inject: [COMERCIANTE_REPOSITORY] },
    {
      provide: RegistrarPuesto,
      useFactory: (p: PuestoRepository, c: ComercianteRepository) => new RegistrarPuesto(p, c),
      inject: [PUESTO_REPOSITORY, COMERCIANTE_REPOSITORY],
    },
    {
      provide: ListarPuestos,
      useFactory: (p: PuestoRepository, c: ComercianteRepository) => new ListarPuestos(p, c),
      inject: [PUESTO_REPOSITORY, COMERCIANTE_REPOSITORY],
    },
  ],
})
export class MerchantsModule {}
