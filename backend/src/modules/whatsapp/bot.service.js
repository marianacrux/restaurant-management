// Capa de aplicación del bot: guarda/lee la sesión (ChatSession) y le da al
// motor acceso al catálogo y al servicio central de pedidos.
//
// Integración futura con WhatsApp Cloud API (Meta): un webhook recibirá el
// mensaje, buscará la sesión por teléfono con `channel: 'WHATSAPP_CLOUD'`,
// llamará a `processMessage` y enviará `replies` con la Graph API. El motor y
// esta capa no cambian; solo se agrega ese adaptador.
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createOrder } from '../orders/order.service.js';
import { createOrderSchema } from '../orders/order.validator.js';
import { getDeliveryFee, getPublicSettings } from '../settings/setting.service.js';
import { handleMessage, startConversation } from './bot.engine.js';

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 h sin actividad = conversación vencida

const STATUS_TEXT = {
  PENDIENTE: 'recibido, pendiente de confirmación',
  CONFIRMADO: 'confirmado, en cola de cocina',
  EN_PREPARACION: 'en preparación 👨‍🍳',
  LISTO: 'listo ✅',
  EN_CAMINO: 'en camino 🛵',
  ENTREGADO: 'entregado 🎉',
  CANCELADO: 'cancelado',
};

/** Funciones que el motor puede usar (todas consultan datos reales). */
async function buildContext() {
  const { restaurantName } = await getPublicSettings();
  return {
    restaurantName,
    async getMenu() {
      const products = await prisma.product.findMany({
        where: { active: true, available: true, category: { active: true } },
        include: { category: { select: { name: true, position: true } } },
        orderBy: [{ category: { position: 'asc' } }, { name: 'asc' }],
      });
      return products.map((p, i) => ({
        n: i + 1,
        productId: p.id,
        name: p.name,
        price: Number(p.price),
        category: p.category.name,
        daily: p.isDailyMenu,
      }));
    },
    getProduct: (id) => prisma.product.findUnique({ where: { id } }),
    getProducts: (ids) => prisma.product.findMany({ where: { id: { in: ids } } }),
    getDeliveryFee: () => getDeliveryFee(),
    // Mismo esquema de validación y mismo servicio que el punto de venta.
    createOrder: (input) => createOrder(createOrderSchema.parse(input), { userId: null }), // userId null = creado por el bot
    async getOrderStatus(orderNumber) {
      const order = await prisma.order.findUnique({ where: { orderNumber }, select: { status: true } });
      return order ? STATUS_TEXT[order.status] : null;
    },
  };
}

export async function startSession({ channel = 'SIMULADOR', phone = null } = {}) {
  const ctx = await buildContext();
  const result = await startConversation(ctx, { phone });
  const session = await prisma.chatSession.create({
    data: { channel, phone, step: result.step, data: result.data },
  });
  return { sessionId: session.id, step: result.step, replies: result.replies };
}

export async function processMessage(sessionId, text) {
  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session) throw AppError.notFound('La conversación no existe. Inicie una nueva.');

  const ctx = await buildContext();
  const expired = Date.now() - session.updatedAt.getTime() > SESSION_TTL_MS;
  const result = expired
    ? await startConversation(ctx, { phone: session.data?.phone }).then((r) => ({
        ...r,
        replies: ['⌛ La conversación anterior venció. Empecemos de nuevo.', ...r.replies],
      }))
    : await handleMessage(session, text, ctx);

  await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      step: result.step,
      data: result.data,
      phone: result.data.phone ?? session.phone,
      ...(result.orderId && { orderId: result.orderId }),
    },
  });

  return {
    sessionId,
    step: result.step,
    replies: result.replies,
    cart: result.data.cart ?? [],
    orderId: result.orderId ?? session.orderId ?? null,
  };
}
