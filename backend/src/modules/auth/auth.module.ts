import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module.js';
import {
  USUARIO_POR_AUTH_ID,
  VERIFICADOR_TOKEN,
  type UsuarioPorAuthIdPort,
  type VerificadorToken,
} from './application/ports/ports.js';
import { AutenticarSolicitud } from './application/use-cases/autenticar-solicitud.use-case.js';
import { AuthController } from './entry-adapters/auth.controller.js';
import { AuthGuard } from './entry-adapters/auth.guard.js';
import { SupabaseVerificadorToken } from './infrastructure/jose-verificador-token.js';
import { UsuarioPorAuthIdAdapter } from './infrastructure/usuario-por-auth-id.adapter.js';

/** Autenticación (Supabase Auth + JWT) y guard global. Seguro por defecto: las rutas son privadas salvo @Public(). */
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    { provide: VERIFICADOR_TOKEN, useClass: SupabaseVerificadorToken },
    { provide: USUARIO_POR_AUTH_ID, useClass: UsuarioPorAuthIdAdapter },
    {
      provide: AutenticarSolicitud,
      useFactory: (v: VerificadorToken, u: UsuarioPorAuthIdPort) => new AutenticarSolicitud(v, u),
      inject: [VERIFICADOR_TOKEN, USUARIO_POR_AUTH_ID],
    },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
