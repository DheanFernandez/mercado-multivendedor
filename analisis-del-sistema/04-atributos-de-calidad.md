# Atributos de Calidad

Los atributos de calidad describen cómo debe comportarse la Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos, considerando aspectos como rendimiento, seguridad, disponibilidad, escalabilidad y mantenibilidad.

| ID | Atributo de calidad | Escenario de calidad |
|---|---|---|
| AC01 | Rendimiento | Las consultas del catálogo, productos, tiendas, carrito y pedidos deben responder adecuadamente incluso cuando existan múltiples usuarios utilizando la plataforma simultáneamente. |
| AC02 | Escalabilidad | La arquitectura debe permitir incorporar nuevos comerciantes, puestos, productos, clientes y repartidores sin requerir una reestructuración completa del sistema. |
| AC03 | Disponibilidad | La plataforma debe mantenerse disponible durante los horarios de operación del mercado y permitir la recuperación de procesos críticos ante fallos temporales. |
| AC04 | Seguridad | Los datos personales, cuentas, documentos, pagos registrados y operaciones críticas deben estar protegidos frente a accesos no autorizados. |
| AC05 | Mantenibilidad | Los módulos deben estar organizados con responsabilidades claramente separadas para facilitar cambios, correcciones y evolución del sistema. |
| AC06 | Observabilidad | El sistema debe registrar errores, eventos relevantes y cambios de estado para facilitar el diagnóstico de fallos y el seguimiento de operaciones críticas. |
| AC07 | Concurrencia | El sistema debe garantizar consistencia cuando múltiples clientes, comerciantes o repartidores realizan operaciones simultáneamente. |
| AC08 | Integridad de la información | Las operaciones relacionadas con inventario, pedidos, pagos y entregas deben ejecutarse sin dejar información parcial o inconsistente. |
| AC09 | Usabilidad | La interfaz debe ser intuitiva, consistente y adaptarse correctamente a computadoras, tabletas y dispositivos móviles. |
| AC10 | Compatibilidad | La plataforma debe funcionar correctamente en los principales navegadores web modernos y ser utilizable desde dispositivos Android e iOS mediante navegador. |
| AC11 | Recuperabilidad | Las operaciones confirmadas no deben perderse ante fallos temporales de red o errores del sistema, y deben existir mecanismos de respaldo y recuperación. |
| AC12 | Privacidad | La información sensible de los usuarios y repartidores debe ser visible únicamente para los usuarios autorizados. |


## Atributos de calidad prioritarios

Para la primera versión del sistema se consideran prioritarios los siguientes atributos:

1. **Seguridad**, debido al manejo de información personal, documentos de repartidores, credenciales y operaciones de pago.
2. **Integridad de la información**, debido a que los procesos de inventario, pedidos, pagos y entregas deben mantenerse consistentes.
3. **Concurrencia**, debido a que varios clientes pueden intentar reservar productos o repartidores simultáneamente.
4. **Rendimiento**, debido a la necesidad de atender consultas frecuentes del catálogo y operaciones comerciales.
5. **Escalabilidad**, debido a que la plataforma debe permitir incorporar nuevos comerciantes, puestos, repartidores y eventualmente nuevos mercados.
6. **Disponibilidad**, debido a que los procesos comerciales deben mantenerse operativos durante los horarios del mercado.
7. **Mantenibilidad**, debido a que el sistema está compuesto por múltiples dominios funcionales que deben evolucionar de forma independiente.