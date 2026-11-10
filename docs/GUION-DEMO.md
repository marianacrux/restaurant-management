# Guion de la demostración (≈ 12 minutos)

## Antes de empezar (10 minutos antes)

1. **Base de datos limpia con datos de demo** — desde `backend/`:
   ```bash
   npm run db:demo
   ```
   Reinicia la base local y crea una semana de pedidos (el dashboard no arranca vacío). Deja un pedido **listo para despachar**, uno **en camino** y dos **en cocina**.
2. **Encender el sistema** — dos terminales:
   ```bash
   cd backend && npm run dev
   ```
   ```bash
   cd frontend && npm run dev
   ```
3. **Comprobar** — `http://localhost:5173/estado` debe mostrar las tres conexiones en verde. Opcional: `cd backend && npm run test:e2e` (52 verificaciones; crea datos de prueba, así que después vuelva a ejecutar `npm run db:demo`).
4. **Pestañas abiertas en este orden** (todas con el usuario **admin**):
   | Pestaña | URL | Preparación |
   |---|---|---|
   | 1 | `/dashboard` | — |
   | 2 | `/cocina` | Tocar **"activar anuncios de voz"** (el navegador lo exige) y subir el volumen |
   | 3 | `/whatsapp` | — |
   | 4 | `/pantalla/1` | Doble clic = pantalla completa (si hay un segundo monitor/TV, ponerla ahí) |
5. En otro navegador o ventana privada, iniciar sesión como **domiciliario** (o tenerlo en el celular) en `/entregas`.

> Contraseña de los usuarios de prueba: `SEED_USER_PASSWORD` en `backend/.env`.

## El recorrido

| Min | Pantalla | Qué hacer | Qué decir |
|---|---|---|---|
| 0:00 | Dashboard | Mostrar indicadores, embudo de estados, ventas por canal y gráfico de 7 días | "Todo lo que llega por cualquier canal se ve aquí, con datos reales de la base." |
| 1:30 | Productos | Cambiar el precio de un plato o marcar algo **agotado** | "El catálogo es uno solo: lo que se cambie aquí se refleja en el bot, el POS y las pantallas." |
| 2:30 | WhatsApp | **Iniciar conversación** → `4 x2 sin cebolla` → `10` → **LISTO** → `1` (domicilio) → nombre → celular → dirección → `1` (efectivo) → **SI** | "El bot muestra solo lo disponible, calcula el domicilio y entrega un número de pedido. Es un simulador: el motor está listo para la API oficial de WhatsApp." |
| 5:00 | Cocina | El pedido aparece resaltado y **se anuncia por voz**. **Iniciar preparación** → **Marcar listo** | "La cocina no tiene que mirar la pantalla: escucha el pedido. Los anuncios hacen fila, se pueden repetir o silenciar." |
| 6:30 | Domicilios | En **Listos para despachar**, elegir un domiciliario y **Despachar**. Intentar asignar otro pedido al mismo domiciliario | "Un domiciliario ocupado no puede recibir otro pedido." |
| 7:30 | Celular (domiciliario) | **Mis entregas** → **Confirmar entrega** | "Vuelve a quedar disponible automáticamente." |
| 8:30 | Detalle del pedido | **Registrar pago** (el monto sugerido es el saldo). Mostrar el **historial** | "El cliente eligió contraentrega, pero el pago solo existe cuando se registra. Todo cambio queda auditado." |
| 9:30 | Dashboard | **Actualizar**: sube la venta, el dinero recibido y el canal WhatsApp | "Canal de origen y método de pago son datos distintos." |
| 10:30 | Pantallas | En `/pantallas` agregar un **anuncio** a la pantalla 4 y guardar; mostrar `/pantalla/1` a `/pantalla/4` | "Cuatro televisores administrados desde un solo lugar; si se agota algo, se marca solo." |
| 11:30 | Cierre | Mostrar `docs/ARQUITECTURA.md` (diagrama) | Qué sigue: WhatsApp real, tiempo real con Socket.IO, promociones completas. |

## Si algo falla

| Síntoma | Solución |
|---|---|
| "No se pudo conectar con la API" | La terminal del backend debe decir `🚀 API escuchando…`; si no, `npm run dev` en `backend/`. |
| La cocina no habla | Tocar "activar anuncios de voz" otra vez (al recargar la página se pierde) y revisar el volumen. El aviso visual sigue funcionando. |
| Domicilios vacío | Solo muestra pedidos con entrega **Domicilio**; en Nuevo pedido elegir el botón 🛵. |
| Datos extraños tras ensayar | `npm run db:demo` deja todo como al inicio. |

## Qué es real y qué es simulado (decirlo con claridad)

- **Real:** base de datos, cálculos, estados, permisos, pagos registrados, entregas, pantallas y anuncios de voz del navegador.
- **Simulado:** la conversación de WhatsApp ocurre en el simulador web; no se conecta todavía con WhatsApp.
- **No incluido en esta etapa:** pasarela de pagos (los pagos se registran manualmente), GPS de domiciliarios, actualizaciones instantáneas (hoy se refresca cada pocos segundos).
