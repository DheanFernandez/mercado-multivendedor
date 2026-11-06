| Ruta | anonimo | cliente | trabajador | comercianteAjeno | comercianteTitular | administrador |
|---|---|---|---|---|---|---|
| GET `/` | ✔ 200 | ✔ 200 | ✔ 200 | ✔ 200 | ✔ 200 | ✔ 200 |
| POST `/api/v1/auth/registro` | ✔ 400 | ✔ 400 | ✔ 400 | ✔ 400 | ✔ 400 | ✔ 400 |
| GET `/api/v1/auth/me` | ✔ 401 | ✔ 200 | ✔ 200 | ✔ 200 | ✔ 200 | ✔ 200 |
| POST `/api/v1/usuarios` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 400 |
| GET `/api/v1/usuarios` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 200 |
| GET `/api/v1/usuarios/:id` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 200 |
| PATCH `/api/v1/usuarios/:id/estado` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 200 |
| PATCH `/api/v1/usuarios/:id/rol` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 200 |
| POST `/api/v1/comerciantes` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 400 |
| GET `/api/v1/comerciantes` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 200 |
| GET `/api/v1/comerciantes/:id` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 200 | ✔ 200 |
| PATCH `/api/v1/comerciantes/:id` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 200 |
| PATCH `/api/v1/comerciantes/:id/estado` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 200 |
| POST `/api/v1/puestos` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 400 |
| GET `/api/v1/puestos` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 200 | ✔ 200 | ✔ 200 |
| GET `/api/v1/puestos/publicos` | ✔ 200 | ✔ 200 | ✔ 200 | ✔ 200 | ✔ 200 | ✔ 200 |
| GET `/api/v1/puestos/:id` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 200 | ✔ 200 |
| PATCH `/api/v1/puestos/:id` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 200 |
| PATCH `/api/v1/puestos/:id/estado` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 200 |
| GET `/api/v1/categorias` | ✔ 200 | ✔ 200 | ✔ 200 | ✔ 200 | ✔ 200 | ✔ 200 |
| GET `/api/v1/categorias/gestion` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 200 |
| POST `/api/v1/categorias` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 400 |
| PATCH `/api/v1/categorias/:id` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 200 |
| PATCH `/api/v1/categorias/:id/estado` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 200 |
| POST `/api/v1/productos` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 400 | ✔ 400 | ✔ 403 |
| GET `/api/v1/productos` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 200 | ✔ 200 | ✔ 200 |
| GET `/api/v1/productos/:id` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 200 | ✔ 200 |
| PATCH `/api/v1/productos/:id` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 200 | ✔ 403 |
| PATCH `/api/v1/productos/:id/estado` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 400 | ✔ 403 |
| POST `/api/v1/productos/:id/imagenes` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 400 | ✔ 403 |
| DELETE `/api/v1/productos/:id/imagenes/:id` | ✔ 401 | ✔ 403 | ✔ 403 | ✔ 403 | ✔ 200 | ✔ 403 |
| GET `/api/v1/catalogo/productos` | ✔ 200 | ✔ 200 | ✔ 200 | ✔ 200 | ✔ 200 | ✔ 200 |
| GET `/api/v1/catalogo/productos/:id` | ✔ 404 | ✔ 404 | ✔ 404 | ✔ 404 | ✔ 404 | ✔ 404 |

**198 de 198 casos conformes** (33 rutas × 6 identidades). ✔ = el resultado coincide con la tabla de permisos; el número es el código HTTP obtenido.
