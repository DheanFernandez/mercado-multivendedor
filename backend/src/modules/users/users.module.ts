import { Module } from '@nestjs/common';
import { PROVEEDOR_IDENTIDAD, type ProveedorIdentidad } from './application/ports/proveedor-identidad.port.js';
import { USUARIO_REPOSITORY, type UsuarioRepository } from './application/ports/usuario.repository.js';
import { ConsultarUsuario } from './application/use-cases/consultar-usuario.use-case.js';
import { ListarUsuarios } from './application/use-cases/listar-usuarios.use-case.js';
import { ObtenerResumenUsuario } from './application/use-cases/obtener-resumen-usuario.use-case.js';
import { RegistrarCliente } from './application/use-cases/registrar-cliente.use-case.js';
import { RegistrarUsuario } from './application/use-cases/registrar-usuario.use-case.js';
import { ResolverUsuarioPorAuthId } from './application/use-cases/resolver-usuario-por-auth-id.use-case.js';
import { UsuariosController } from './entry-adapters/controllers/usuarios.controller.js';
import { SupabaseIdentidadAdapter } from './infrastructure/identity/supabase-identidad.adapter.js';
import { PrismaUsuarioRepository } from './infrastructure/persistence/prisma-usuario.repository.js';

const caso = <T>(provide: new (...a: any[]) => T, build: (r: UsuarioRepository, i: ProveedorIdentidad) => T) => ({
  provide,
  useFactory: (r: UsuarioRepository, i: ProveedorIdentidad) => build(r, i),
  inject: [USUARIO_REPOSITORY, PROVEEDOR_IDENTIDAD],
});

/** Raíz de composición del módulo: conecta puertos con adaptadores. */
@Module({
  controllers: [UsuariosController],
  providers: [
    { provide: USUARIO_REPOSITORY, useClass: PrismaUsuarioRepository },
    { provide: PROVEEDOR_IDENTIDAD, useClass: SupabaseIdentidadAdapter },
    caso(RegistrarUsuario, (r, i) => new RegistrarUsuario(r, i)),
    caso(RegistrarCliente, (r, i) => new RegistrarCliente(r, i)),
    caso(ConsultarUsuario, (r) => new ConsultarUsuario(r)),
    caso(ListarUsuarios, (r) => new ListarUsuarios(r)),
    caso(ObtenerResumenUsuario, (r) => new ObtenerResumenUsuario(r)),
    caso(ResolverUsuarioPorAuthId, (r) => new ResolverUsuarioPorAuthId(r)),
  ],
  exports: [ObtenerResumenUsuario, ResolverUsuarioPorAuthId, RegistrarCliente, ConsultarUsuario],
})
export class UsersModule {}
