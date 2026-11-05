# Nivel 2 · Diagrama de Contenedores

> **Proyecto:** Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos
> **Modelo:** C4 · Nivel 2 de 4 · **Versión:** 1.1

---

## 1. Objetivo

Abrir la caja «Plataforma Integral Multivendedor» del nivel 1 y mostrar los **contenedores** que la forman: las aplicaciones y almacenes de datos que se ejecutan por separado, la tecnología de cada uno y cómo se comunican.

| Aspecto | Descripción |
|---|---|
| Pregunta que responde | ¿De qué piezas ejecutables se compone el sistema y con qué tecnología? |
| Audiencia | Arquitectos, desarrolladores, operaciones |
| Qué es un contenedor | Algo que se ejecuta o almacena datos de forma independiente: una aplicación web, una API, una base de datos (no es lo mismo que un contenedor Docker) |
| Nivel anterior | [Nivel 1 · Diagrama de contexto](Nivel1-DiagramadeContextodelSistema.md) |
| Siguiente nivel | [Nivel 3 · Diagrama de componentes](Nivel3-Diagrama-de-Componentes.md) |

---

## 2. Diagrama

```mermaid
flowchart TB
    U["👤 Cliente · Comerciante ·<br/>Trabajador de puesto · Administrador"]

    subgraph SYS["Plataforma Integral Multivendedor"]
        direction TB
        WEB["<b>Aplicación Web/PWA</b><br/><i>[Next.js + TypeScript]</i><br/>Marketplace, carrito, resumen del pago único,<br/>redirección al Checkout y paneles por rol"]
        API["<b>API de la plataforma</b><br/><i>[NestJS + TypeScript]</i><br/>API REST · monolito modular<br/>Incluye el adaptador de pasarela de pago<br/>y el endpoint del Webhook"]
        DB[("<b>Base de datos</b><br/><i>[PostgreSQL · Supabase]</i><br/>Usuarios, puestos, productos, inventario,<br/>pedidos, pagos, notificaciones de pago,<br/>cuentas vinculadas cifradas, auditoría")]
    end

    ST["Almacenamiento de archivos<br/><i>[Supabase Storage / Cloudflare R2]</i>"]
    MP["Mercado Pago<br/><i>[Sistema externo · Sandbox]</i><br/>Checkout, API de pagos y reembolsos"]

    U -->|"Usa desde el navegador<br/>(HTTPS)"| WEB
    WEB -->|"Llama a la API<br/>(HTTPS/JSON)"| API
    API -->|"Lee y escribe<br/>(SQL)"| DB
    API -->|"Guarda y obtiene archivos<br/>(HTTPS/API)"| ST
    WEB -->|"Muestra imágenes<br/>(HTTPS, URL firmada o pública)"| ST
    WEB -->|"Redirige al cliente al Checkout<br/>(HTTPS)"| MP
    API -->|"Crea cobros, consulta pagos<br/>y reembolsa (HTTPS/JSON)"| MP
    MP -->|"Notifica el resultado del pago<br/>(Webhook HTTPS firmado)"| API

    classDef person fill:#08427b,stroke:#052e56,color:#ffffff
    classDef container fill:#438dd5,stroke:#2e6295,color:#ffffff
    classDef db fill:#438dd5,stroke:#2e6295,color:#ffffff
    classDef external fill:#999999,stroke:#6b6b6b,color:#ffffff
    class U person
    class WEB,API container
    class DB db
    class ST,MP external
```

---

## 3. Contenedores

| Contenedor | Tecnología | Responsabilidad | Datos que maneja |
|---|---|---|---|
| **Aplicación Web/PWA** | Next.js + TypeScript | Interfaz responsive para clientes, comerciantes, trabajadores de puesto y administradores. Muestra el resumen del pago único y redirige al cliente al Checkout de Mercado Pago con la URL entregada por la API. Se puede instalar como PWA en Android e iOS | Ninguno persistente; solo el estado de la pantalla y la sesión. No recibe ni almacena datos de tarjetas |
| **API de la plataforma** | NestJS + TypeScript | Expone la API REST, aplica las reglas de negocio y controla los permisos por rol y por puesto. Es un **monolito modular**: un solo proceso con módulos internos ([ADR-001](../01-analisis-de-sistema/decisiones/ADR-001-monolito-modular.md)). El módulo Pagos contiene el **adaptador de pasarela** (`PasarelaPagoPort` / `MercadoPagoCheckoutAdapter`) y el endpoint público del Webhook ([ADR-005](../01-analisis-de-sistema/decisiones/ADR-005-pago-unico-mercado-pago.md)) | Ninguno propio; usa la base de datos, el almacenamiento y la API de Mercado Pago |
| **Base de datos** | PostgreSQL (Supabase) | Almacena de forma permanente la información del negocio y garantiza la consistencia mediante transacciones ([ADR-003](../01-analisis-de-sistema/decisiones/ADR-003-control-concurrencia.md)) | Usuarios, roles, comerciantes, puestos, cuentas de Mercado Pago vinculadas (tokens cifrados), productos, inventario, carritos, pedidos, pagos, notificaciones de pago, comisiones, reembolsos, outbox, incidencias, auditoría |
| **Almacenamiento de archivos** *(externo)* | Supabase Storage (alternativa: Cloudflare R2) | Guarda los archivos digitales | Imágenes de productos y tiendas, documentos de la plataforma |
| **Mercado Pago** *(externo)* | Checkout y API REST de Mercado Pago (Sandbox) | Procesa el pago único del pedido, notifica su resultado y ejecuta reembolsos | Datos de pago del cliente (fuera de la plataforma) |

---

## 4. Relaciones

| Origen | Destino | Descripción | Protocolo |
|---|---|---|---|
| Usuarios | Aplicación Web/PWA | Usan la aplicación desde el navegador | HTTPS |
| Aplicación Web/PWA | API de la plataforma | Llama a la API REST; obtiene la URL del Checkout al iniciar el pago | HTTPS/JSON |
| Aplicación Web/PWA | Mercado Pago | Redirige al cliente al Checkout y recibe el retorno solo para mostrar el resultado | HTTPS (redirección) |
| API de la plataforma | Mercado Pago | Crea el cobro, consulta el estado del pago y ejecuta reembolsos mediante el adaptador de pasarela | HTTPS/JSON |
| Mercado Pago | API de la plataforma | Notifica el resultado del pago al endpoint del Webhook | HTTPS (Webhook firmado) |
| API de la plataforma | Base de datos | Lee y escribe información | SQL sobre TCP |
| API de la plataforma | Almacenamiento de archivos | Sube y elimina archivos | HTTPS/API |
| Aplicación Web/PWA | Almacenamiento de archivos | Muestra imágenes | HTTPS |

---

## 5. Decisiones arquitectónicas reflejadas

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Un único contenedor de backend (monolito modular) | Microservicios | Equipo de 2 integrantes; las operaciones de pedido, inventario y pago necesitan consistencia transaccional ([ADR-001](../01-analisis-de-sistema/decisiones/ADR-001-monolito-modular.md)) |
| Frontend separado del backend (Web/PWA + API REST) | Lógica de negocio en el frontend | Las reglas y permisos se aplican siempre en el backend (RC06, DA05) |
| PostgreSQL como base de datos | Base de datos NoSQL | Inventario, pedidos y pagos necesitan transacciones y actualizaciones condicionales ([ADR-003](../01-analisis-de-sistema/decisiones/ADR-003-control-concurrencia.md)) |
| Aplicación Web/PWA | Aplicación móvil nativa | Restricción RC15; una sola aplicación para computadoras y móviles (DA13) |
| Adaptador de pasarela dentro de la API, no un contenedor separado | Servicio de pagos independiente | Mantener un único despliegue (DA14) y aislar Mercado Pago mediante `PasarelaPagoPort` ([ADR-005](../01-analisis-de-sistema/decisiones/ADR-005-pago-unico-mercado-pago.md)) |
| El estado del pago se determina por el Webhook verificado y la consulta a la API | Confiar en el retorno del Checkout en el navegador | El navegador puede ser manipulado; solo la API confirma el pago (DA03, DA08) |

---

## 6. Seguridad entre contenedores

| Comunicación | Medida |
|---|---|
| Navegador → Aplicación Web/PWA y API | Tráfico cifrado con HTTPS |
| Aplicación Web/PWA → API | Cada petición lleva el token de sesión del usuario; la API verifica el rol y el puesto antes de ejecutar la operación |
| Aplicación Web/PWA → Mercado Pago | Solo se redirige al cliente con la URL del Checkout generada por la API; los datos de tarjeta se ingresan en Mercado Pago y nunca pasan por la plataforma. Los parámetros de retorno del Checkout no cambian el estado del pago |
| Mercado Pago → API (Webhook) | Endpoint público sin sesión de usuario, autenticado por **firma**: se valida el HMAC-SHA256 de la cabecera `x-signature` con la clave secreta del Webhook y se rechazan firmas ausentes, inválidas o con marca de tiempo fuera de tolerancia. Después se consulta el pago en la API de Mercado Pago antes de modificar cualquier estado, y el procesamiento es idempotente |
| API → Mercado Pago | Credenciales de la plataforma (Sandbox) y clave secreta del Webhook en variables de entorno o gestor de secretos; nunca en el código ni en el frontend |
| Credenciales de los comerciantes | Los tokens obtenidos al vincular cada cuenta de Mercado Pago se guardan **cifrados** en la base de datos (cifrado simétrico autenticado, por ejemplo AES-256-GCM, con la clave de cifrado fuera de la base de datos); solo el adaptador de pasarela los descifra y no se registran en logs ni se devuelven en respuestas |
| API → Base de datos | Credenciales en variables de entorno; la base de datos no se expone directamente al navegador |
| API → Almacenamiento | Credenciales solo en el servidor; los archivos sensibles se entregan mediante URL firmadas y temporales |

> **TODO:** definir el mecanismo de autenticación de usuarios (por ejemplo, Supabase Auth o JWT propio de NestJS) como parte de la estrategia de seguridad pendiente del driver DA03.
