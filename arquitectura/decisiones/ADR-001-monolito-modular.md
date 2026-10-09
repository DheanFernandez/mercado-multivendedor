
# ADR-001: Adopción de un Monolito Modular

## 1. Información de la decisión

| Campo | Descripción |
|---|---|
| ID | ADR-001 |
| Título | Adopción de un monolito modular |
| Estado | Propuesta |
| Fecha | 08/10/2026 |
| Proyecto | Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos |
| Drivers relacionados | DA05, DA14, DA16 |
| Atributos de calidad | AC02 - Escalabilidad, AC05 - Mantenibilidad |

## 2. Contexto

La plataforma integrará diferentes procesos comerciales y operativos de un mercado de abastos, incluyendo la administración de comerciantes y puestos, productos, inventarios, carrito multivendedor, pedidos, repartidores, pagos mediante códigos QR y entregas.

Estos procesos requieren comunicación entre módulos y consistencia de la información, especialmente durante la generación de pedidos, reserva de inventario y asignación de repartidores.

El proyecto académico debe desarrollarse de forma progresiva y mantenerse comprensible para el equipo de trabajo.

Por ello, es necesario seleccionar una organización del backend que permita separar responsabilidades sin introducir una complejidad operativa excesiva durante la primera versión.

## 3. Problema arquitectónico

¿Cómo organizar los módulos de negocio de la plataforma para facilitar su desarrollo, mantenimiento y crecimiento, manteniendo una implementación y un despliegue manejables?

## 4. Alternativas evaluadas

| Alternativa | Ventajas | Desventajas |
|---|---|---|
| Monolito tradicional | Implementación y despliegue inicial sencillos. | Puede generar alto acoplamiento si no existe una separación clara de responsabilidades. |
| Microservicios | Permiten desplegar y escalar servicios de manera independiente. | Aumentan la complejidad de comunicación, despliegue, monitoreo y consistencia distribuida. |
| Monolito modular | Permite separar responsabilidades por módulos y mantener un despliegue unificado. | Requiere disciplina para conservar los límites entre módulos y no permite escalar cada módulo de manera independiente. |

## 5. Decisión arquitectónica

Se propone adoptar un **monolito modular** para la primera versión de la plataforma.

El backend se desarrollará mediante NestJS y TypeScript, organizando las funcionalidades en módulos claramente diferenciados dentro de una misma aplicación desplegable.

Los módulos principales serán:

- Autenticación y usuarios.
- Comerciantes, puestos y tiendas virtuales.
- Productos y categorías.
- Inventario.
- Marketplace y catálogo.
- Carrito multivendedor.
- Pedidos.
- Repartidores.
- Pagos.
- Delivery.
- Promociones.
- Incidencias.
- Notificaciones.
- Auditoría.
- Inteligencia artificial.
- Reportes.

Cada módulo tendrá responsabilidades definidas y deberá comunicarse con otros módulos mediante interfaces o contratos explícitos cuando sea necesario.

Los módulos no deberán acceder directamente a los detalles internos de otros módulos.

## 6. Justificación

La decisión responde principalmente a:

**DA05 - Escalabilidad y modularidad:** permite incorporar nuevos comerciantes, puestos y funcionalidades sin reorganizar completamente la solución.

**DA14 - Mantenibilidad y evolución modular:** facilita separar responsabilidades y modificar funcionalidades sin afectar innecesariamente otros módulos.

**DA16 - Arquitectura de tres capas:** permite implementar la lógica de negocio en un backend unificado dentro de la arquitectura cliente-servidor definida.

La elección también facilita la implementación de operaciones que requieren consistencia transaccional, como la reserva de inventario y la asignación de repartidores.

El monolito modular permite mantener dichas operaciones dentro de una misma aplicación, utilizando PostgreSQL como sistema principal de persistencia.

## 7. Consecuencias

### Consecuencias positivas

- Organización del backend por dominios funcionales.
- Menor complejidad de despliegue inicial.
- Desarrollo y depuración centralizados.
- Posibilidad de aplicar transacciones en operaciones críticas.
- Facilidad para implementar pruebas de integración.
- Evolución progresiva de la plataforma.

### Consecuencias negativas

- Los módulos comparten inicialmente el mismo proceso de ejecución.
- Un fallo no controlado puede afectar a otros módulos.
- El despliegue se realiza de manera conjunta.
- El escalamiento independiente de módulos requeriría cambios arquitectónicos.

## 8. Medidas para reducir riesgos

Para evitar que el monolito modular evolucione hacia una estructura altamente acoplada, se establecerán las siguientes medidas:

1. Separar los módulos según sus responsabilidades de negocio.
2. Evitar dependencias circulares entre módulos.
3. Definir contratos para la comunicación entre módulos.
4. Aplicar Clean Architecture para proteger las reglas de negocio.
5. Mantener pruebas unitarias y de integración.
6. Separar los servicios externos mediante interfaces y adaptadores.
7. Registrar las decisiones arquitectónicas relevantes mediante ADR.

## 9. Resultado esperado

El resultado será un backend NestJS organizado en módulos funcionales, mantenible y preparado para evolucionar progresivamente.

La solución conservará un despliegue inicial unificado, mientras que la separación modular permitirá evaluar futuras extracciones de servicios independientes si el crecimiento del sistema lo requiere.

## 10. Relación con otras decisiones

- ADR-002: Aplicación de Clean Architecture.
- ADR-003: Control de concurrencia en inventario y repartidores.
- ADR-004: Gestión de pagos externos mediante QR.
