# Restricciones Arquitectónicas

Las restricciones arquitectónicas representan condiciones tecnológicas, organizacionales y de alcance que deben respetarse durante el desarrollo de la Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos.

| ID | Restricción | Descripción |
|---|---|---|
| RC01 | Aplicación Web/PWA | La solución deberá implementarse como una aplicación web responsive, accesible desde navegadores modernos y preparada para funcionar como PWA. |
| RC02 | Frontend con Next.js | La capa de presentación deberá desarrollarse utilizando Next.js. |
| RC03 | TypeScript en frontend | El frontend deberá utilizar TypeScript como lenguaje principal de desarrollo. |
| RC04 | Backend con NestJS | La lógica de negocio deberá implementarse mediante NestJS. |
| RC05 | TypeScript en backend | El backend deberá utilizar TypeScript como lenguaje principal de desarrollo. |
| RC06 | API REST | La comunicación entre frontend y backend deberá realizarse mediante una API REST. |
| RC07 | PostgreSQL | La información estructurada del sistema deberá almacenarse utilizando PostgreSQL. |
| RC08 | Supabase | La solución utilizará Supabase como plataforma principal para servicios de base de datos y almacenamiento según corresponda. |
| RC09 | Almacenamiento de archivos | Las imágenes, documentos de verificación, códigos QR y evidencias podrán almacenarse mediante Supabase Storage o Cloudflare R2. |
| RC10 | Git y GitHub | El código fuente y la documentación deberán gestionarse mediante Git y mantenerse en un repositorio de GitHub. |
| RC11 | Arquitectura de tres capas | La solución deberá organizarse mediante una arquitectura cliente-servidor de tres capas: presentación, lógica de negocio y datos. |
| RC12 | Enfoque modular | Los dominios funcionales deberán mantenerse organizados en módulos claramente separados. |
| RC13 | Pagos mediante Yape o Plin | En la primera versión, los pagos se realizarán mediante códigos QR de Yape o Plin al repartidor. |
| RC14 | Sin pasarela bancaria | La primera versión no utilizará una pasarela bancaria ni procesamiento automático de pagos mediante API. |
| RC15 | Sin aplicación móvil nativa | La primera versión no desarrollará aplicaciones móviles nativas para Android o iOS. |
| RC16 | Sin integración con SUNAT | La facturación electrónica integrada con SUNAT no formará parte de la primera versión. |
| RC17 | Sin GPS en tiempo real | La primera versión no implementará seguimiento GPS en tiempo real del repartidor. |
| RC18 | Sin integración con hardware especializado | No se contemplará integración con balanzas electrónicas, dispositivos IoT u otro hardware especializado. |
| RC19 | Sin verificación automática con RENIEC | La primera versión no realizará verificación automática de identidad mediante servicios externos como RENIEC. |
| RC20 | Despliegue mediante Internet | La solución deberá poder desplegarse y ser accesible públicamente mediante Internet. |

## Restricciones con mayor impacto arquitectónico

Las siguientes restricciones tienen una influencia directa en la estructura técnica del sistema:

- **RC06 - API REST**, porque define la forma de comunicación entre la capa de presentación y la lógica de negocio.
- **RC07 - PostgreSQL**, porque determina la tecnología principal de persistencia.
- **RC11 - Arquitectura de tres capas**, porque establece la organización general de la solución.
- **RC12 - Enfoque modular**, porque condiciona la separación de dominios funcionales.
- **RC13 - Pagos mediante Yape o Plin**, porque define el flujo de pago de la primera versión.
- **RC14 - Sin pasarela bancaria**, porque obliga a que la validación del pago sea gestionada dentro del flujo operativo del repartidor.