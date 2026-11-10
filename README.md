# Sistema de Gestión de Pedidos — Restaurante

MVP de un sistema que centraliza los pedidos de WhatsApp, vitrina, punto de venta y domicilios en una sola plataforma.

**Arquitectura:** monolito modular — `frontend/` (React + Vite) y `backend/` (Node.js + Express 5 + Prisma 6 + PostgreSQL 17). JavaScript en todo el proyecto.

📐 [Arquitectura y decisiones](docs/ARQUITECTURA.md) · 🎬 [Guion de la demostración](docs/GUION-DEMO.md) · 🧪 [Colección Postman](docs/postman/restaurant-api.postman_collection.json)

## Estado del MVP

| Módulo | Estado |
|---|---|
| Autenticación y roles (admin, cajero, cocina, domiciliario) | ✅ Real |
| Catálogo, categorías, agotados, menú del día | ✅ Real |
| Pedidos centralizados (4 canales), estados, historial | ✅ Real |
| Dashboard (ventas, canales, métodos de pago, 7 días) | ✅ Real |
| Cocina con anuncios de voz (SpeechSynthesis del navegador) | ✅ Real |
| Domiciliarios, despacho y confirmación de entrega | ✅ Real |
| Pagos, saldos y reembolsos | ✅ Real (registro manual, sin pasarela) |
| 4 pantallas digitales administrables | ✅ Real |
| Bot de WhatsApp | 🟡 **Simulado** en la web; motor listo para WhatsApp Cloud API |
| Tiempo real | 🟡 Refresco periódico (4–30 s); preparado para Socket.IO |
| Promociones | 🟡 Se muestran en pantallas; falta gestión completa y aplicarlas al pedido |
| GPS, rutas, app móvil nativa, pasarela de pagos | ⏳ Fuera del alcance del demo |

## Requisitos

- Node.js ≥ 20.19 (Vite 8 lo exige)
- PostgreSQL 17 en `localhost:5432`

## Puesta en marcha

### 1. Base de datos (una sola vez)

Desde la raíz del repositorio, como superusuario `postgres` (pedirá su contraseña):

```bash
/Library/PostgreSQL/17/bin/psql -U postgres -h localhost -f backend/scripts/create-database.sql
```

Crea el usuario `restaurant_app` (con permiso `CREATEDB`, que Prisma necesita para su *shadow database*) y la base `restaurant_db`. Ese archivo no se sube a Git; en otra máquina, copie `backend/.env.example` a `backend/.env` y cree el usuario con su propia contraseña.

### 2. Backend

```bash
cd backend
npm install
npm run db:check                 # verifica la conexión a PostgreSQL
npx prisma migrate deploy        # crea las tablas
npm run db:seed                  # usuarios de prueba, catálogo, domiciliarios, pantallas
npm run dev                      # http://localhost:4000/api
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

En desarrollo, Vite redirige `/api` al backend (sin problemas de CORS).

## Scripts del backend

| Script | Descripción |
|---|---|
| `npm run dev` | API con recarga automática |
| `npm run db:check` | Prueba la conexión a PostgreSQL |
| `npm run prisma:validate` | Valida `schema.prisma` |
| `npm run prisma:migrate` | Crea y aplica migraciones |
| `npm run prisma:studio` | Explorador visual de la BD |
| `npm run db:seed` | Datos iniciales (idempotente) |
| `npm run db:demo` | ⚠️ **Borra la base local** y la deja con datos de demostración (una semana de pedidos). Solo para desarrollo |
| `npm run test:e2e` | Prueba de aceptación de punta a punta (52 verificaciones; requiere el backend encendido y crea datos de prueba) |

## Usuarios de prueba (creados por `npm run db:seed`)

| Rol | Correo |
|---|---|
| ADMIN | `admin@restaurante.test` |
| CAJERO | `cajero@restaurante.test` |
| COCINA | `cocina@restaurante.test` |
| DOMICILIARIO | `domiciliario@restaurante.test` |

Todos usan la contraseña definida en `SEED_USER_PASSWORD` de `backend/.env` (no se versiona).

## Pruebas con Postman

Importe `docs/postman/restaurant-api.postman_collection.json`, asigne la variable de colección `password` y ejecute un *Login*: el token se guarda solo.

## Endpoints disponibles

Respuestas de error uniformes: `{ "error": "mensaje", "details": [...] }`. Los valores monetarios llegan como texto (`"47000"`) para no perder precisión.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/health` | Público | Estado de la API y de PostgreSQL (200 / 503) |
| POST | `/api/auth/login` | Público | Devuelve `{ token, user }` |
| GET | `/api/auth/me` | Autenticado | Usuario de la sesión |
| GET | `/api/categories` | Público | Categorías activas (`includeInactive=true` solo ADMIN) |
| POST / PUT | `/api/categories[/:id]` | ADMIN | Crear / editar |
| GET | `/api/products` | Público | Filtros: `categoryId`, `available`, `dailyMenu`, `featured`, `search` |
| GET | `/api/products/:id` | Público | Detalle |
| POST / PUT | `/api/products[/:id]` | ADMIN | Crear / editar |
| PATCH | `/api/products/:id/availability` | ADMIN, CAJERO, COCINA | Marcar agotado / disponible |
| DELETE | `/api/products/:id` | ADMIN | Desactiva (no borra el historial) |
| GET | `/api/orders` | ADMIN, CAJERO, COCINA | Filtros: `status`, `source`, `type`, `paymentStatus` (admiten lista `A,B`), `from`, `to`, `search`, `page`, `pageSize` |
| GET | `/api/orders/:id` | ADMIN, CAJERO, COCINA | Detalle con ítems, pagos, entrega e historial |
| GET | `/api/orders/:id/history` | ADMIN, CAJERO, COCINA | Historial de estados y cambios |
| POST | `/api/orders` | ADMIN, CAJERO | Crear pedido (precios y totales los calcula el backend) |
| PATCH | `/api/orders/:id` | ADMIN, CAJERO | Notas, dirección, método de pago elegido |
| POST | `/api/orders/:id/items` | ADMIN, CAJERO | Agregar productos (solo PENDIENTE / CONFIRMADO) |
| PATCH | `/api/orders/:id/status` | ADMIN, CAJERO, COCINA | Cambiar estado según rol y máquina de estados |
| GET | `/api/dashboard/summary?date=AAAA-MM-DD` | ADMIN, CAJERO | Indicadores del día (hora de Colombia) |
| GET | `/api/dashboard/sales?from&to` | ADMIN, CAJERO | Ventas por día (por defecto, últimos 7) |
| GET | `/api/settings` | Autenticado | Costo del domicilio y nombre del restaurante |

| GET | `/api/delivery-persons` | ADMIN, CAJERO | Domiciliarios con entrega actual y entregas del día |
| POST / PUT | `/api/delivery-persons[/:id]` | ADMIN | Registrar / editar (`active:false` = retirar) |
| PATCH | `/api/delivery-persons/:id/availability` | ADMIN, CAJERO | DISPONIBLE ↔ INACTIVO (OCUPADO lo pone el sistema) |
| GET | `/api/deliveries` | ADMIN, CAJERO, DOMICILIARIO | Entregas (el domiciliario solo ve las suyas) |
| POST | `/api/deliveries/assign` | ADMIN, CAJERO | `{orderId, deliveryPersonId}`: pedido LISTO → EN_CAMINO, domiciliario → OCUPADO |
| PATCH | `/api/deliveries/:id/status` | ADMIN, CAJERO, DOMICILIARIO | `{status:"ENTREGADO"}`: pedido → ENTREGADO, domiciliario libre |
| GET | `/api/payments` | ADMIN, CAJERO | Filtros: `method`, `status`, `source`, `orderId`, `from`, `to` + total recaudado |
| POST | `/api/payments` | ADMIN, CAJERO | Registrar pago (nunca supera el saldo; no en pedidos cancelados) |
| PATCH | `/api/payments/:id` | ADMIN | `{status:"REEMBOLSADO", notes}` |

| POST | `/api/whatsapp-simulator/session` | ADMIN, CAJERO | Inicia una conversación simulada (`phone` opcional) |
| POST | `/api/whatsapp-simulator/message` | ADMIN, CAJERO | `{sessionId, text}` → respuestas del bot |
| POST | `/api/whatsapp-simulator/confirm` | ADMIN, CAJERO | Atajo de "SI" en el paso de confirmación |
| GET | `/api/screens/:numero/content` | **Público** | Contenido listo para el televisor (precios y disponibilidad en vivo) |
| GET | `/api/screens` · `/api/screens/:numero/config` | ADMIN | Pantallas y su configuración |
| PUT | `/api/screens/:numero/content` | ADMIN | Reemplaza el contenido (`items` ordenados: PRODUCTO, PROMOCION, ANUNCIO) |
| GET | `/api/promotions` | ADMIN, CAJERO | Promociones con precio final calculado |

**Reglas de pagos:** el estado de pago del pedido se calcula a partir de sus pagos (PENDIENTE → PARCIAL → PAGADO; REEMBOLSADO). Elegir un método al crear el pedido no registra ningún pago. La fila del pedido se bloquea (`SELECT … FOR UPDATE`) para que dos cobros simultáneos no superen el total.

Cada pedido incluye `availableStatuses`: los cambios de estado que el usuario actual puede hacer (el frontend dibuja sus botones con esto).

### Ciclo de vida del pedido

```
PENDIENTE → CONFIRMADO → EN_PREPARACION → LISTO → ENTREGADO        (en local / para llevar)
                                            └──→ EN_CAMINO → ENTREGADO (domicilio, vía módulo de entregas)
Cualquier estado no final → CANCELADO (requiere motivo)
```

| Rol | Puede llevar un pedido a |
|---|---|
| ADMIN | todos |
| CAJERO | CONFIRMADO, ENTREGADO, CANCELADO |
| COCINA | EN_PREPARACION, LISTO |

## Estado

- [x] Día 1 — estructura, Express, Prisma, conexión a BD, modelo de datos
- [x] Día 2 — migración, seed, autenticación JWT por roles, categorías, productos, servicio central de pedidos
- [x] Día 3 — login y navegación por rol, dashboard, pedidos (listado, detalle, nuevo), cocina con anuncios de voz
- [x] Día 4 — domiciliarios, despacho y entregas, pagos y reembolsos, gestión de productos
- [x] Día 5 — simulador de WhatsApp (bot) y 4 pantallas digitales administrables
- [x] Días 6-7 — prueba de aceptación automatizada, datos de demostración, documentación y guion

## Bot de WhatsApp (simulado)

> **Es un simulador.** No envía ni recibe mensajes reales de WhatsApp. No se usan automatizaciones no oficiales.

- `modules/whatsapp/bot.engine.js`: máquina de estados **independiente del canal** (MENU → TIPO → NOMBRE → TELEFONO → DIRECCION → PAGO → CONFIRMAR → FINALIZADO). Recibe la sesión y el texto; devuelve el nuevo estado y las respuestas.
- `modules/whatsapp/bot.service.js`: guarda la conversación en `ChatSession` y conecta el motor con el catálogo y con el **mismo** `createOrder` (y la misma validación) que usa el punto de venta.
- El menú solo incluye productos disponibles; la disponibilidad se vuelve a verificar al agregar y al confirmar.
- **Integración real (siguiente etapa):** agregar un webhook para *WhatsApp Business Platform (Cloud API)* que busque la sesión por teléfono (`channel: WHATSAPP_CLOUD`), llame a `processMessage` y envíe las respuestas con la Graph API. El motor no cambia.

## Pantallas digitales

Cada televisor abre `http://<servidor>:5173/pantalla/1` … `/pantalla/4` (sin iniciar sesión; doble clic = pantalla completa). Se actualizan cada 30 s y rotan páginas cada 12 s. Si se pierde la conexión siguen mostrando la última información. El contenido se administra en `/pantallas`.

## Pantallas (frontend)

| Ruta | Roles | Descripción |
|---|---|---|
| `/login` | — | Inicio de sesión |
| `/dashboard` | ADMIN, CAJERO | Indicadores del día, embudo de estados, ventas por canal / método / día |
| `/pedidos` | ADMIN, CAJERO, COCINA | Listado con búsqueda y filtros (en la URL) |
| `/pedidos/nuevo` | ADMIN, CAJERO | Punto de venta |
| `/pedidos/:id` | ADMIN, CAJERO, COCINA | Detalle, historial y acciones según rol |
| `/domicilios` | ADMIN, CAJERO | Despacho: listos → asignar, en camino → confirmar; estado de domiciliarios |
| `/entregas` | DOMICILIARIO | Mis entregas (dirección, teléfono, monto a cobrar, confirmar) |
| `/pagos` | ADMIN, CAJERO | Pendientes de cobro y pagos registrados con filtros |
| `/productos` | ADMIN (CAJERO: solo agotado/disponible) | Catálogo, precios, menú del día, destacados |
| `/whatsapp` | ADMIN, CAJERO | Simulador de conversación con el bot |
| `/pantallas` | ADMIN | Administración de las 4 pantallas con vista previa |
| `/pantalla/:numero` | Público | Vista para televisor |
| `/cocina` | ADMIN, CAJERO, COCINA | Tablero de cocina a pantalla completa con anuncios de voz |
| `/estado` | Público | Verificación Frontend → API → PostgreSQL |

**Audio de cocina:** se activa con un toque (requisito de los navegadores). Usa `SpeechSynthesis` con cola (sin superposición), tono previo, botón de repetir y silencio persistente. Funciona en Chrome, Edge y Safari.

**Actualización:** por ahora con consultas periódicas (cocina 4 s, pedidos 15 s, dashboard 30 s) centralizadas en `hooks/useResource.js`; en la etapa 2 se sustituye por Socket.IO.
