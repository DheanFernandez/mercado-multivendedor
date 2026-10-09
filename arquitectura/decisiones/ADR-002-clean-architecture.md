
# ADR-002: Aplicación de Clean Architecture

## 1. Información de la decisión

| Campo | Descripción |
|---|---|
| ID | ADR-002 |
| Título | Aplicación de Clean Architecture |
| Estado | Propuesta |
| Fecha | 08/10/2026 |
| Proyecto | Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos |
| Driver principal | DA14 - Mantenibilidad y evolución modular |
| Drivers relacionados | DA04, DA05, DA06, DA13 |
| Atributos de calidad | AC04 - Seguridad, AC05 - Mantenibilidad, AC11 - Recuperabilidad |

## 2. Contexto

La plataforma estará compuesta por módulos responsables de usuarios, comerciantes, puestos, productos, inventario, carrito, pedidos, repartidores, pagos y entregas.

Estos módulos contienen reglas de negocio que deben mantenerse independientes de las tecnologías utilizadas para construir la interfaz, almacenar información o comunicarse con servicios externos.

Por ejemplo, las reglas que impiden reservar inventario insuficiente o asignar un mismo repartidor a dos pedidos incompatibles deben conservarse incluso si posteriormente se cambia la base de datos o el framework utilizado.

El sistema utilizará Next.js en la capa de presentación, NestJS en el backend y PostgreSQL mediante Supabase para la persistencia.

Sin una organización adecuada, estas tecnologías podrían quedar directamente acopladas a las reglas del negocio, dificultando las pruebas y el mantenimiento.

## 3. Problema arquitectónico

¿Cómo organizar las responsabilidades y dependencias internas de los módulos para proteger las reglas de negocio frente a cambios en frameworks, bases de datos y servicios externos?

## 4. Alternativas evaluadas

| Alternativa | Ventajas | Limitaciones |
|---|---|---|
| Arquitectura tradicional por capas técnicas | Organización inicial sencilla y conocida. | Puede generar dependencias directas de la lógica de negocio hacia infraestructura si no se controlan las dependencias. |
| Arquitectura Hexagonal | Separa el núcleo del negocio mediante puertos y adaptadores. | Requiere definir contratos y adaptadores de manera disciplinada. |
| Clean Architecture | Define una separación explícita entre dominio, aplicación, adaptadores e infraestructura, orientando las dependencias hacia el núcleo del negocio. | Introduce mayor estructura y archivos, especialmente en funcionalidades pequeñas. |

## 5. Decisión arquitectónica

Se propone aplicar **Clean Architecture** como enfoque para organizar internamente los módulos de negocio del backend NestJS.

La estructura se organizará en cuatro partes principales:

### 5.1. Dominio (Domain)

Contendrá las entidades, objetos de valor y reglas fundamentales del negocio.

Ejemplos:

- Pedido.
- Producto.
- Inventario.
- Reserva de stock.
- Repartidor.
- Reserva de repartidor.
- Reglas de transición de estados.
- Validaciones de cantidades y disponibilidad.

El dominio no deberá importar directamente NestJS, PostgreSQL, Supabase ni bibliotecas de infraestructura.

### 5.2. Aplicación (Application)

Contendrá los casos de uso que coordinan las operaciones del sistema.

Ejemplos:

- CrearPedido.
- ReservarInventario.
- SeleccionarRepartidor.
- ValidarPago.
- RegistrarCompra.
- ConfirmarEntrega.

También definirá las interfaces necesarias para acceder a servicios externos y persistencia, como:

- PedidoRepository.
- InventarioRepository.
- RepartidorRepository.
- PagoRepository.
- NotificacionService.

Los casos de uso dependerán del dominio y de abstracciones, no de implementaciones concretas de infraestructura.

### 5.3. Presentación y adaptadores de entrada

Permitirá recibir solicitudes de los usuarios y transformarlas en operaciones de aplicación.

En el backend comprenderá principalmente:

- Controladores REST de NestJS.
- Validación de solicitudes.
- Transformación de datos de entrada y salida.
- Manejo de respuestas HTTP.

El frontend Next.js será un cliente separado que consumirá la API REST.

Los controladores deberán delegar las operaciones a los casos de uso, evitando contener directamente las reglas del negocio.

### 5.4. Infraestructura (Infrastructure)

Contendrá implementaciones concretas relacionadas con tecnologías externas.

Ejemplos:

- Repositorios PostgreSQL.
- Conexión con Supabase.
- Adaptadores de almacenamiento de archivos.
- Implementación de notificaciones.
- Integración opcional con servicios de inteligencia artificial.
- Configuración de frameworks y proveedores externos.

Esta capa implementará los contratos definidos por las capas internas.

## 6. Regla de dependencias

Las dependencias del código fuente deberán orientarse hacia las reglas del negocio.

Se establecerán las siguientes reglas:

1. El dominio no dependerá de aplicación, presentación ni infraestructura.
2. La aplicación podrá depender del dominio y de sus propias interfaces.
3. Los controladores de presentación podrán depender de casos de uso de aplicación.
4. La infraestructura podrá depender de interfaces definidas en aplicación y de tipos del dominio.
5. Las implementaciones concretas de repositorios no deberán ser importadas directamente por los casos de uso.
6. La composición de dependencias mediante NestJS se realizará en los módulos de configuración correspondientes.

El acceso a PostgreSQL se realizará mediante implementaciones concretas de interfaces de repositorio.

Esto permitirá sustituir o modificar la tecnología de persistencia sin alterar innecesariamente las reglas del negocio.

## 7. Ejemplo aplicado: creación de un pedido

El proceso de creación de un pedido permite ilustrar la separación de responsabilidades.

**Presentación**

El controlador REST recibe la solicitud del cliente para generar un pedido.

**Aplicación**

El caso de uso CrearPedido coordina la validación del carrito, la comprobación de disponibilidad y la creación del pedido.

**Dominio**

Las entidades y reglas de negocio validan las cantidades, la estructura multivendedor y las transiciones permitidas.

**Infraestructura**

Los repositorios concretos implementan las operaciones necesarias sobre PostgreSQL.

La coordinación transaccional deberá garantizar que las reservas de inventario y los cambios de estado se realicen de manera consistente.

## 8. Relación con los drivers arquitectónicos

| Driver | Respuesta de Clean Architecture |
|---|---|
| DA04 - Seguridad | Separa las reglas de autorización y negocio de los mecanismos técnicos de autenticación. |
| DA05 - Escalabilidad y modularidad | Favorece la evolución de funcionalidades mediante límites y contratos definidos. |
| DA06 - API REST | Permite que REST funcione como adaptador de entrada sin condicionar las reglas del negocio. |
| DA13 - Aislamiento de fallos | Facilita sustituir o aislar integraciones externas mediante abstracciones. |
| DA14 - Mantenibilidad | Reduce el acoplamiento y protege el dominio frente a cambios tecnológicos. |

Clean Architecture no garantiza por sí sola la escalabilidad, la seguridad ni la tolerancia a fallos; estos atributos requerirán mecanismos adicionales.

## 9. Consecuencias

### Consecuencias positivas

- Mayor separación de responsabilidades.
- Reglas de negocio independientes de frameworks.
- Facilidad para implementar pruebas unitarias.
- Posibilidad de sustituir adaptadores de infraestructura.
- Menor acoplamiento entre casos de uso y tecnologías externas.
- Mejor organización de los módulos.

### Consecuencias negativas

- Mayor cantidad de interfaces, clases y archivos.
- Necesidad de definir correctamente los límites entre capas.
- Mayor esfuerzo de organización inicial.
- Riesgo de generar abstracciones innecesarias en funcionalidades sencillas.

## 10. Medidas para reducir riesgos

1. Aplicar las capas de manera proporcional a la complejidad de cada módulo.
2. Evitar interfaces que no aporten desacoplamiento real.
3. Mantener las reglas de negocio fuera de los controladores REST.
4. Implementar pruebas unitarias sobre dominio y aplicación.
5. Evitar dependencias circulares.
6. Mantener contratos explícitos entre módulos.
7. Revisar las dependencias durante el desarrollo.

## 11. Resultado esperado

El backend NestJS estará organizado en módulos funcionales con responsabilidades internas claramente separadas.

Los casos de uso y las reglas de negocio podrán probarse sin depender directamente de una base de datos real o de servicios externos.

La arquitectura continuará siendo cliente-servidor de tres capas a nivel global y monolito modular a nivel de despliegue.

## 12. Relación con otras decisiones

- ADR-001: Adopción de un monolito modular.
- ADR-003: Control de concurrencia en inventario y repartidores.
- ADR-004: Gestión de pagos mediante códigos QR.
