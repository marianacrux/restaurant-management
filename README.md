# Sistema de Gestión de Pedidos — Restaurante

MVP de un sistema que centraliza los pedidos de WhatsApp, vitrina, punto de venta y domicilios en una sola plataforma.

**Arquitectura:** monolito modular — `frontend/` (React + Vite) y `backend/` (Node.js + Express 5 + Prisma 6 + PostgreSQL 17). JavaScript en todo el proyecto.

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
npm run db:check   # verifica la conexión a PostgreSQL
npm run dev        # http://localhost:4000/api
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
| `npm run db:seed` | Datos iniciales |

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
- [ ] Día 3 — dashboard, listado/detalle de pedidos (frontend), cocina con audio
