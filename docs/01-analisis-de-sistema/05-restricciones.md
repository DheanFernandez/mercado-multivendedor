# Restricciones Arquitectónicas

Las restricciones arquitectónicas representan condiciones tecnológicas, organizacionales y de alcance que deben respetarse durante el desarrollo de la Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos.

| ID | Restricción | Descripción |
|---|---|---|
| RC01 | Aplicación Web/PWA | La solución deberá implementarse como una aplicación web responsive, accesible desde navegadores modernos y preparada para funcionar como PWA. |
| RC02 | Frontend con Next.js | La aplicación Web/PWA deberá desarrollarse utilizando Next.js. |
| RC03 | TypeScript en frontend | El frontend deberá utilizar TypeScript como lenguaje principal de desarrollo. |
| RC04 | Backend con NestJS | La lógica de negocio deberá implementarse mediante NestJS. |
| RC05 | TypeScript en backend | El backend deberá utilizar TypeScript como lenguaje principal de desarrollo. |
| RC06 | API REST | La comunicación entre frontend y backend deberá realizarse mediante una API REST. |
| RC07 | PostgreSQL | La información estructurada del sistema deberá almacenarse utilizando PostgreSQL. |
| RC08 | Supabase | La solución utilizará inicialmente Supabase como proveedor de PostgreSQL y, según corresponda, de servicios de almacenamiento. |
| RC09 | Almacenamiento de archivos | Los archivos digitales se almacenarán inicialmente mediante Supabase Storage, manteniendo Cloudflare R2 como alternativa tecnológica futura. |
| RC10 | Git y GitHub | El código fuente y la documentación deberán gestionarse mediante Git y mantenerse en un repositorio de GitHub. |
| RC11 | Equipo reducido y despliegue simple | El proyecto lo desarrollan 2 integrantes en un semestre; la lógica de negocio debe poder desplegarse y operarse como una única aplicación. |
| RC12 | Enfoque modular | Los dominios funcionales deberán mantenerse organizados en módulos claramente separados. |
| RC13 | Pago único mediante Mercado Pago | En la primera versión, el cliente realizará un pago único por su pedido mediante Mercado Pago (Checkout), utilizando el entorno Sandbox. La confirmación del pago será recibida automáticamente por la plataforma desde la pasarela. |
| RC14 | Integración con pasarela Mercado Pago | El sistema se integrará con la pasarela Mercado Pago en entorno Sandbox. La comisión de la pasarela será asumida por el comerciante y cada comerciante deberá vincular su cuenta de Mercado Pago a la plataforma. |
| RC15 | Sin aplicación móvil nativa | La primera versión no desarrollará aplicaciones móviles nativas para Android o iOS. |
| RC16 | Sin integración con SUNAT | La facturación electrónica integrada con SUNAT no formará parte de la primera versión. |
| RC17 | Sin servicio de delivery | La plataforma no gestionará reparto a domicilio ni contemplará el rol de repartidor. Los productos de cada puesto serán retirados por el cliente en el puesto correspondiente. |
| RC18 | Sin integración con hardware especializado | No se contemplará integración con balanzas electrónicas, dispositivos IoT u otro hardware especializado. |
| RC19 | Sin verificación automática con RENIEC | La primera versión no realizará verificación automática de identidad mediante servicios externos como RENIEC. |
| RC20 | Despliegue mediante Internet | La solución deberá poder desplegarse y ser accesible públicamente mediante Internet. |

## Restricciones con mayor impacto arquitectónico

Las siguientes restricciones tienen una influencia directa en la estructura técnica del sistema:

- **RC06 - API REST**, porque define la forma de comunicación entre la aplicación Web/PWA y la lógica de negocio.
- **RC07 - PostgreSQL**, porque determina la tecnología principal de persistencia.
- **RC11 - Equipo reducido y despliegue simple**, porque condiciona la organización general de la solución hacia una lógica de negocio desplegable y operable como una única aplicación.
- **RC12 - Enfoque modular**, porque condiciona la separación de dominios funcionales.
- **RC13 - Pago único mediante Mercado Pago**, porque define el flujo de pago de la primera versión mediante un único cobro por pedido a través de Mercado Pago Checkout.
- **RC14 - Integración con pasarela Mercado Pago**, porque obliga a integrar la plataforma con la API de Mercado Pago (Sandbox) y a gestionar la vinculación de la cuenta de Mercado Pago de cada comerciante.
- **RC17 - Sin servicio de delivery**, porque limita el proceso del pedido a la preparación y el retiro en el puesto, sin módulos de reparto.
