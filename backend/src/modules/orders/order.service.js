// SERVICIO CENTRAL DE PEDIDOS.
// Todos los canales (punto de venta, vitrina, domicilios y el bot de WhatsApp)
// crean y modifican pedidos SOLO a través de estas funciones. Así las reglas
// (precios, disponibilidad, estados, historial) se aplican igual en todos lados.
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { getDeliveryFee } from '../settings/setting.service.js';
import { buildOrderLines, computeTotal } from './order.pricing.js';
import {
  CLOSED_STATUSES,
  DELIVERY_ONLY_STATUSES,
  EDITABLE_ITEMS_STATUSES,
  ROLE_ALLOWED_TARGETS,
  STATUS_TRANSITIONS,
} from './order.constants.js';

const userName = { select: { id: true, name: true } };

const listInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  items: { select: { id: true, productName: true, quantity: true, notes: true, unitPrice: true, subtotal: true } },
  delivery: { include: { deliveryPerson: { select: { id: true, name: true, phone: true } } } },
};

const detailInclude = {
  ...listInclude,
  items: true,
  createdBy: userName,
  payments: { include: { recordedBy: userName }, orderBy: { createdAt: 'asc' } },
  statusHistory: { include: { changedBy: userName }, orderBy: { createdAt: 'asc' } },
};

// ----------------------------------------------------------------- CREAR

/**
 * Crea un pedido de cualquier canal.
 * @param {object} input  Datos validados por createOrderSchema.
 * @param {{ userId?: number|null }} actor  null = creado por el bot / sistema.
 */
export async function createOrder(input, { userId = null } = {}) {
  const { customer, items, confirm, ...orderData } = input;
  const initialStatus = confirm ? 'CONFIRMADO' : 'PENDIENTE';

  const orderId = await prisma.$transaction(async (tx) => {
    const { lines, subtotal } = await buildOrderLines(tx, items);
    const deliveryFee = orderData.type === 'DOMICILIO' ? await getDeliveryFee(tx) : 0;

    // El cliente se identifica por teléfono: si ya existe, se actualiza su nombre.
    const savedCustomer = customer
      ? await tx.customer.upsert({
          where: { phone: customer.phone },
          update: { name: customer.name },
          create: customer,
        })
      : null;

    const order = await tx.order.create({
      data: {
        ...orderData,
        status: initialStatus,
        paymentStatus: 'PENDIENTE', // elegir un método de pago NO significa haber pagado
        customerId: savedCustomer?.id ?? null,
        createdById: userId,
        subtotal,
        deliveryFee,
        total: computeTotal({ subtotal, deliveryFee }),
        items: { create: lines },
        statusHistory: {
          create: { previousStatus: null, newStatus: initialStatus, changedById: userId, note: `Pedido creado (${orderData.source})` },
        },
      },
      select: { id: true },
    });
    return order.id;
  });

  return getOrder(orderId);
}

// --------------------------------------------------------------- CONSULTAR

export async function listOrders(filters) {
  const { status, source, type, paymentStatus, from, to, search, page, pageSize, sort } = filters;

  const where = {
    ...(status && { status: { in: status } }),
    ...(source && { source: { in: source } }),
    ...(type && { type: { in: type } }),
    ...(paymentStatus && { paymentStatus: { in: paymentStatus } }),
    ...((from || to) && { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } }),
    ...(search && { OR: buildSearch(search) }),
  };

  const [total, data] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: listInclude,
      orderBy: { createdAt: sort }, // cocina usa 'asc': primero el más antiguo
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

function buildSearch(search) {
  const conditions = [
    { customer: { name: { contains: search, mode: 'insensitive' } } },
    { customer: { phone: { contains: search } } },
  ];
  if (/^\d+$/.test(search) && Number(search) <= 2_147_483_647) conditions.push({ orderNumber: Number(search) });
  return conditions;
}

export async function getOrder(id) {
  const order = await prisma.order.findUnique({ where: { id }, include: detailInclude });
  if (!order) throw AppError.notFound('Pedido no encontrado');
  return order;
}

export async function getOrderHistory(id) {
  await assertOrderExists(id);
  return prisma.orderStatusHistory.findMany({
    where: { orderId: id },
    include: { changedBy: userName },
    orderBy: { createdAt: 'asc' },
  });
}

// --------------------------------------------------------------- ESTADOS

/**
 * Cambia el estado validando la máquina de estados y los permisos del rol.
 * Las entregas a domicilio (EN_CAMINO / ENTREGADO) van por el módulo de entregas.
 */
export async function changeOrderStatus(id, { status, note, cancelReason }, user) {
  const allowedForRole = ROLE_ALLOWED_TARGETS[user.role] ?? [];
  if (!allowedForRole.includes(status)) {
    throw AppError.forbidden(`El rol ${user.role} no puede cambiar pedidos a ${status}`);
  }

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id }, select: { id: true, status: true, type: true } });
    if (!order) throw AppError.notFound('Pedido no encontrado');

    if (order.type === 'DOMICILIO' && DELIVERY_ONLY_STATUSES.includes(status)) {
      throw AppError.conflict('En pedidos a domicilio este estado se cambia desde el módulo de domicilios');
    }
    if (order.type !== 'DOMICILIO' && status === 'EN_CAMINO') {
      throw AppError.conflict('Solo los pedidos a domicilio pueden estar EN_CAMINO');
    }

    await transitionOrderStatus(tx, order, status, { userId: user.id, note, cancelReason });
  });

  return getOrder(id);
}

/**
 * Estados a los que `role` puede llevar el pedido desde PATCH /status.
 * El frontend pinta sus botones con esto: las reglas viven solo en el backend.
 */
export function getAvailableStatuses(order, role) {
  const roleTargets = ROLE_ALLOWED_TARGETS[role] ?? [];
  return (STATUS_TRANSITIONS[order.status] ?? []).filter(
    (s) =>
      roleTargets.includes(s) &&
      !(order.type === 'DOMICILIO' && DELIVERY_ONLY_STATUSES.includes(s)) &&
      !(order.type !== 'DOMICILIO' && s === 'EN_CAMINO'),
  );
}

/**
 * Bloque reutilizable (también lo usará el módulo de entregas): valida la
 * transición, actualiza el pedido y registra el historial dentro de `tx`.
 * La condición `status: order.status` en el update evita que dos usuarios
 * cambien el mismo pedido a la vez (control de concurrencia optimista).
 */
export async function transitionOrderStatus(tx, order, newStatus, { userId = null, note, cancelReason } = {}) {
  const allowed = STATUS_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw AppError.conflict(`No se puede pasar de ${order.status} a ${newStatus}`, { allowed });
  }

  const { count } = await tx.order.updateMany({
    where: { id: order.id, status: order.status },
    data: { status: newStatus, ...(newStatus === 'CANCELADO' && { cancelReason }) },
  });
  if (count === 0) throw AppError.conflict('El pedido fue modificado por otro usuario. Recargue e intente de nuevo');

  await tx.orderStatusHistory.create({
    data: {
      orderId: order.id,
      previousStatus: order.status,
      newStatus,
      changedById: userId,
      note: newStatus === 'CANCELADO' ? `Cancelado: ${cancelReason}` : note,
    },
  });
}

// ------------------------------------------------------- MODIFICACIONES

/** Agrega productos mientras la cocina no haya empezado. Recalcula totales. */
export async function addItems(id, { items }, user) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id } });
    if (!order) throw AppError.notFound('Pedido no encontrado');
    if (!EDITABLE_ITEMS_STATUSES.includes(order.status)) {
      throw AppError.conflict(`No se pueden agregar productos a un pedido ${order.status}`);
    }

    const { lines, subtotal: added } = await buildOrderLines(tx, items);
    const subtotal = order.subtotal.add(added);

    const { count } = await tx.order.updateMany({
      where: { id, status: order.status, updatedAt: order.updatedAt },
      data: {
        subtotal,
        total: computeTotal({ subtotal, discount: order.discount, deliveryFee: order.deliveryFee }),
      },
    });
    if (count === 0) throw AppError.conflict('El pedido fue modificado por otro usuario. Recargue e intente de nuevo');

    await tx.orderItem.createMany({ data: lines.map((l) => ({ ...l, orderId: id })) });
    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        previousStatus: order.status,
        newStatus: order.status,
        changedById: user.id,
        note: `Productos agregados: ${lines.map((l) => `${l.quantity}x ${l.productName}`).join(', ')}`,
      },
    });
  });

  return getOrder(id);
}

/** Modifica datos permitidos (notas, dirección, método de pago elegido). */
export async function updateOrder(id, data, user) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id } });
    if (!order) throw AppError.notFound('Pedido no encontrado');
    if (CLOSED_STATUSES.includes(order.status)) throw AppError.conflict(`Un pedido ${order.status} no se puede modificar`);
    if (data.deliveryAddress && order.type !== 'DOMICILIO') {
      throw AppError.badRequest('Solo los pedidos a domicilio llevan dirección');
    }

    await tx.order.update({ where: { id }, data });
    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        previousStatus: order.status,
        newStatus: order.status,
        changedById: user.id,
        note: `Datos actualizados: ${Object.keys(data).join(', ')}`,
      },
    });
  });

  return getOrder(id);
}

async function assertOrderExists(id) {
  const exists = await prisma.order.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw AppError.notFound('Pedido no encontrado');
}
