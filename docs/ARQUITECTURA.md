# Arquitectura del sistema

Sistema de gestión de pedidos para un restaurante que centraliza los canales **WhatsApp, vitrina, punto de venta y domicilios** en una sola plataforma.

## 1. Visión general

**Monolito modular**: una sola API (Express) y una sola aplicación web (React), separadas en módulos por funcionalidad. Se eligió en lugar de microservicios porque lo desarrolla una sola persona y debe construirse, probarse y desplegarse rápido; los módulos están separados para poder extraerse más adelante si fuera necesario.

```
 Canales de entrada                    API REST (Express 5)                     PostgreSQL 17
 ───────────────────                   ─────────────────────                    ─────────────
 Simulador WhatsApp ─┐                 ┌──────────────────────┐
 (bot, canal-agnóst.)│                 │  modules/orders      │
 Punto de venta ─────┼──► /api ───────►│  createOrder()  ◄────┼── ÚNICO punto de    ──► Prisma ORM
 Vitrina ────────────┤                 │  (precios, totales,  │   creación de pedidos
 Domicilio telefónico┘                 │   disponibilidad,    │
                                       │   historial)         │
                                       └──────────┬───────────┘
                                                  │
         ┌───────────────┬────────────────┬───────┴───────┬──────────────┬──────────────┐
      Dashboard        Cocina          Domicilios        Pagos        Pantallas      Productos
      (admin/caja)  (voz + tablero)   (despacho/entrega) (caja)      (TV públicas)   (catálogo)
```

Todos los canales llaman al **mismo** `order.service.createOrder` con el **mismo** esquema de validación (`createOrderSchema`). Ningún canal tiene su propia lógica de creación de pedidos.

## 2. Tecnologías

| Capa | Tecnología | Nota |
|---|---|---|
| Frontend | React 19 + Vite 8, React Router 7, Axios, CSS Modules | JavaScript, sin TypeScript |
| Backend | Node.js 20 + Express 5 | ESM; Express 5 propaga errores de funciones `async` |
| Validación | zod 4 | En backend (fuente de verdad) y validaciones equivalentes en los formularios |
| Base de datos | PostgreSQL 17 + Prisma 6.19 | Versión fijada: en npm, `latest` apuntaba a una RC de Prisma 8 |
| Autenticación | JWT (`jsonwebtoken`) + `bcryptjs` | El usuario se verifica contra la BD en cada petición |

## 3. Estructura

```
backend/src/
  config/        env.js (variables validadas), prisma.js (cliente único)
  middlewares/   auth.js (authenticate/authorize), validate.js (zod), errorHandler.js
  modules/       un directorio por funcionalidad: *.routes.js, *.service.js, *.validator.js
    auth  categories  products  orders  dashboard  settings
    delivery-persons  deliveries  payments  whatsapp  screens  health
  utils/         AppError, fechas en hora de Colombia, esquemas reutilizables
backend/prisma/  schema.prisma, migrations/, seed.js
backend/scripts/ check-db.js, e2e-acceptance.js, demo-data.js

frontend/src/
  components/    kit de UI (ui/), tablas, badges, paneles de pago y entrega
  context/       AuthContext (sesión), ToastContext (mensajes)
  hooks/         useResource (carga + refresco), useSpeechAnnouncer (voz), useDebouncedValue
  pages/         una carpeta por módulo
  services/      un archivo por recurso de la API (único lugar que hace HTTP)
  styles/        tokens.css (colores, espacios), shared.module.css
```

## 4. Modelo de datos

| Entidad | Para qué |
|---|---|
| `User` | Personal con rol: ADMIN, CAJERO, COCINA, DOMICILIARIO |
| `Customer` | Cliente identificado por teléfono (único) |
| `Category`, `Product` | Catálogo. `available=false` = agotado; `active=false` = retirado (nunca se borra) |
| `Order` | Pedido. `source` (canal) ≠ `type` (en local / para llevar / domicilio) ≠ `paymentMethod` (lo que eligió el cliente) |
| `OrderItem` | Copia del **nombre y precio** al momento del pedido (historial intacto aunque cambie el catálogo) |
| `OrderStatusHistory` | Cada cambio de estado o modificación, con quién y cuándo |
| `Payment` | Dinero realmente recibido. `Order.paymentStatus` se **deriva** de los pagos |
| `DeliveryPerson`, `Delivery` | Domiciliarios y entregas (una vigente por pedido) |
| `Promotion`, `MenuScreen`, `ScreenContent` | Promociones y contenido de las 4 pantallas |
| `ChatSession` | Estado de cada conversación del bot (canal SIMULADOR o WHATSAPP_CLOUD) |
| `Setting` | Parámetros del negocio (costo de domicilio, nombre del restaurante) |

Dinero en `Decimal(12,2)` (nunca `Float`); se envía como texto (`"47000"`) para no perder precisión. Índices en estado, canal, estado de pago, fecha y cliente.

## 5. Reglas de negocio clave

- **Precios y totales solo en el backend.** El cliente envía productos y cantidades; los precios enviados se ignoran.
- **Disponibilidad única para todos los canales.** Agotado en el catálogo = no aparece en el bot, se marca en las pantallas y el POS/API lo rechazan (409).
- **Máquina de estados** (`order.constants.js`): `PENDIENTE → CONFIRMADO → EN_PREPARACION → LISTO → (EN_CAMINO →) ENTREGADO`, `CANCELADO` desde cualquier estado no final con motivo obligatorio. Cada rol solo puede ciertas transiciones; el backend envía `availableStatuses` y el frontend dibuja los botones con eso.
- **Domicilios:** asignar solo pedidos LISTO a domiciliarios DISPONIBLES (reserva atómica); el domiciliario queda OCUPADO hasta confirmar la entrega. Cancelar un pedido en camino lo libera.
- **Pagos:** un pago se registra cuando se recibe el dinero, nunca por elegir un método. No se puede cobrar más que el saldo (fila del pedido bloqueada con `SELECT … FOR UPDATE`) ni pedidos cancelados. Reembolsos solo para ADMIN.
- **Ventas:** los cancelados nunca suman. "Hoy" se calcula en hora de Colombia (UTC−5).
- **Concurrencia:** los cambios de estado usan control optimista (`updateMany ... where status = actual`): si dos personas cambian el mismo pedido, una recibe 409.
- **Transacciones** en toda operación que toca varias tablas (crear pedido, despachar, entregar, pagar, guardar pantalla).

## 6. Seguridad

- Contraseñas con bcrypt; el login responde igual si el correo no existe (no revela usuarios).
- JWT con expiración (8 h). En cada petición se verifica que el usuario siga activo.
- Autorización por rol en cada ruta (`authorize(...)`) y reglas finas en los servicios.
- Variables de entorno validadas al arrancar; `.env` y el script SQL con la contraseña están fuera de Git.
- Rutas públicas: solo lectura del catálogo, categorías, `/health` y el contenido de las pantallas.

## 7. Preparado para la siguiente etapa

| Tema | Cómo quedó preparado |
|---|---|
| **Tiempo real (Socket.IO)** | `server.js` crea el `http.Server` aparte de `app.js`; el frontend centraliza el refresco en `hooks/useResource.js` (hoy consulta cada 4–30 s). Basta con emitir eventos al crear/cambiar pedidos y llamar `reload()` al recibirlos. |
| **WhatsApp Cloud API (Meta)** | El motor `bot.engine.js` no conoce el canal. Falta un webhook que busque la sesión por teléfono (`channel: WHATSAPP_CLOUD`), llame a `processMessage` y envíe las respuestas con la Graph API. No se usan automatizaciones no oficiales. |
| **Imágenes** | Los productos guardan `imageUrl` (URL o ruta). Se puede conectar un almacenamiento externo sin cambiar el modelo. |
| **Promociones** | Modelo y lectura listos (con precio final calculado). Falta la pantalla de gestión completa y aplicar descuentos al pedido. |

## 8. Pruebas

- `npm run test:e2e` (backend encendido): **52 verificaciones** contra la API real — escenario de 20 pasos, verificaciones obligatorias y matriz de permisos.
- Pruebas manuales en navegador de cada módulo durante los días 3–5 (ver historial de commits).
