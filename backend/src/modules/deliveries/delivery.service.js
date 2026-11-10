// Despacho de pedidos a domicilio.
// Flujo: pedido LISTO -> asignar domiciliario DISPONIBLE -> pedido EN_CAMINO y
// domiciliario OCUPADO -> confirmar entrega -> pedido ENTREGADO y domiciliario
// DISPONIBLE (si no tiene más entregas). Todo ocurre en transacciones.
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { transitionOrderStatus } from '../orders/order.service.js';
import { ACTIVE_DELIVERY_STATUSES, releaseDeliveryPersonIfIdle } from './delivery.helpers.js';

const include = {
  deliveryPerson: { select: { id: true, name: true, phone: true, transportType: true } },
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      deliveryAddress: true,
      notes: true,
      paymentMethod: true,
      paymentStatus: true,
      createdAt: true,
      customer: { select: { name: true, phone: true } },
      items: { select: { id: true, productName: true, quantity: true, notes: true } },
    },
  },
};

export async function listDeliveries({ status, deliveryPersonId } = {}, user) {
  const where = {
    ...(status && { status: { in: status } }),
    ...(deliveryPersonId && { deliveryPersonId }),
  };

  // El domiciliario solo ve SUS entregas, sin importar los filtros que envíe.
  if (user.role === 'DOMICILIARIO') {
    const me = await prisma.deliveryPerson.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!me) return [];
    where.deliveryPersonId = me.id;
  }

  return prisma.delivery.findMany({ where, include, orderBy: [{ status: 'asc' }, { assignedAt: 'desc' }], take: 100 });
}

export async function assignDelivery({ orderId, deliveryPersonId }, user) {
  const deliveryId = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, status: true, type: true, delivery: true },
    });
    if (!order) throw AppError.notFound('Pedido no encontrado');
    if (order.type !== 'DOMICILIO') throw AppError.conflict(`El pedido #${order.orderNumber} no es a domicilio`);
    if (order.status !== 'LISTO') {
      throw AppError.conflict(`Solo se despachan pedidos LISTOS (el #${order.orderNumber} está ${order.status})`);
    }
    if (order.delivery && ACTIVE_DELIVERY_STATUSES.includes(order.delivery.status)) {
      throw AppError.conflict(`El pedido #${order.orderNumber} ya tiene domiciliario asignado`);
    }

    const person = await tx.deliveryPerson.findUnique({ where: { id: deliveryPersonId } });
    if (!person || !person.active) throw AppError.notFound('Domiciliario no encontrado o desactivado');
    if (person.availability !== 'DISPONIBLE') {
      throw AppError.conflict(`${person.name} no puede recibir pedidos: está ${person.availability}`);
    }

    // Reserva atómica: si otro usuario lo asignó en este mismo instante, count = 0.
    const { count } = await tx.deliveryPerson.updateMany({
      where: { id: person.id, availability: 'DISPONIBLE', active: true },
      data: { availability: 'OCUPADO' },
    });
    if (count === 0) throw AppError.conflict(`${person.name} acaba de recibir otro pedido`);

    const now = new Date();
    const data = { deliveryPersonId: person.id, status: 'EN_CAMINO', assignedAt: now, pickedUpAt: now, deliveredAt: null };
    const delivery = order.delivery
      ? await tx.delivery.update({ where: { id: order.delivery.id }, data }) // reasignación tras una cancelación
      : await tx.delivery.create({ data: { ...data, orderId: order.id } });

    await transitionOrderStatus(tx, order, 'EN_CAMINO', { userId: user.id, note: `Asignado a ${person.name}` });
    return delivery.id;
  });

  return getDelivery(deliveryId);
}

export async function completeDelivery(id, user) {
  await prisma.$transaction(async (tx) => {
    const delivery = await tx.delivery.findUnique({
      where: { id },
      include: { deliveryPerson: true, order: { select: { id: true, status: true } } },
    });
    if (!delivery) throw AppError.notFound('Entrega no encontrada');
    if (user.role === 'DOMICILIARIO' && delivery.deliveryPerson.userId !== user.id) {
      throw AppError.forbidden('Esta entrega no está asignada a usted');
    }

    const { count } = await tx.delivery.updateMany({
      where: { id, status: { in: ACTIVE_DELIVERY_STATUSES } },
      data: { status: 'ENTREGADO', deliveredAt: new Date() },
    });
    if (count === 0) throw AppError.conflict(`La entrega ya está ${delivery.status}`);

    await transitionOrderStatus(tx, delivery.order, 'ENTREGADO', {
      userId: user.id,
      note: `Entrega confirmada · ${delivery.deliveryPerson.name}`,
    });
    await releaseDeliveryPersonIfIdle(tx, delivery.deliveryPersonId);
  });

  return getDelivery(id);
}

export async function getDelivery(id) {
  const delivery = await prisma.delivery.findUnique({ where: { id }, include });
  if (!delivery) throw AppError.notFound('Entrega no encontrada');
  return delivery;
}
