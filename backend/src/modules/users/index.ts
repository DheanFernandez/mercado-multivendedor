/** API pública del módulo Usuarios: lo único que otros módulos pueden importar. */
export { ConsultarUsuario } from './application/use-cases/consultar-usuario.use-case.js';
export { ObtenerResumenUsuario } from './application/use-cases/obtener-resumen-usuario.use-case.js';
export { RegistrarCliente } from './application/use-cases/registrar-cliente.use-case.js';
export { ResolverUsuarioPorAuthId } from './application/use-cases/resolver-usuario-por-auth-id.use-case.js';
export { vistaUsuario } from './entry-adapters/controllers/usuarios.controller.js';
