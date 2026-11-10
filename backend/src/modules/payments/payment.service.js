// Pagos. Reglas clave:
// - Un pago solo existe cuando el dinero se recibió: elegir un método al
//   hacer el pedido NO crea pagos ni marca el pedido como PAGADO.
// - El estado de pago del pedido se DERIVA de sus pagos (nunca se edita a mano).
// - No se puede cobrar más que el saldo pendiente ni cobrar pedidos cancelados.
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { localDayRange } from '../../utils/dates.js';

const ZERO = new Prisma.Decimal(0);

const include = {
  recordedBy: { select: { id: true, name: true } },
  order: {
    select: { id: true, orderNumber: true, source: true, status: true, total: true, customer: { select: { name: true } } },
  },
};

/** Suma de pagos vigentes (PAGADO) de un pedido. */
async function paidAmount(tx, orderId) {
  const agg = await tx.payment.aggregate({ where: { orderId, status: 'PAGADO' }, _sum: { amount: true } });
  return agg._sum.amount ?? ZERO;
}

/** Recalcula Order.paymentStatus a partir de sus pagos. */
export async function recomputeOrderPaymentStatus(tx, orderId) {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { total: true } });
  const paid = await paidAmount(tx, orderId);
  const refunds = await tx.payment.count({ where: { orderId, status: 'REEMBOLSADO' } });

  let paymentStatus = 'PENDIENTE';
  if (paid.gte(order.total) && paid.gt(0)) paymentStatus = 'PAGADO';
  else if (paid.gt(0)) paymentStatus = 'PARCIAL';
  else if (refunds > 0) paymentStatus = 'REEMBOLSADO';

  await tx.order.update({ where: { id: orderId }, data: { paymentStatus } });
  return { paymentStatus, paid, balance: order.total.sub(paid) };
}

export async function registerPayment({ orderId, method, amount, reference, notes }, user) {
  const paymentId = await prisma.$transaction(async (tx) => {
    // Bloquea la fila del pedido: dos cajeros no pueden cobrar el mismo saldo a la vez.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true, orderNumber: true, status: true, total: true } });
    if (!order) throw AppError.notFound('Pedido no encontrado');
    if (order.status === 'CANCELADO') throw AppError.conflict(`El pedido #${order.orderNumber} está cancelado: no se registran pagos`);

    const balance = order.total.sub(await paidAmount(tx, orderId));
    if (balance.lte(0)) throw AppError.conflict(`El pedido #${order.orderNumber} ya está pagado`);
    const value = new Prisma.Decimal(amount);
    if (value.gt(balance)) {
      throw AppError.conflict(`El monto supera el saldo pendiente del pedido #${order.orderNumber} (${balance.toString()})`, {
        balance: balance.toString(),
      });
    }

    const payment = await tx.payment.create({
      data: { orderId, method, amount: value, status: 'PAGADO', reference: reference || null, notes: notes || null, recordedById: user.id },
    });
    await recomputeOrderPaymentStatus(tx, orderId);
    return payment.id;
  });

  return getPayment(paymentId);
}

/** Marca un pago como REEMBOLSADO (se conserva el registro para auditoría). */
export async function refundPayment(id, { notes }, user) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id } });
    if (!payment) throw AppError.notFound('Pago no encontrado');
    const { count } = await tx.payment.updateMany({
      where: { id, status: 'PAGADO' },
      data: { status: 'REEMBOLSADO', notes: [payment.notes, `Reembolso (${user.name}): ${notes}`].filter(Boolean).join(' · ') },
    });
    if (count === 0) throw AppError.conflict(`Solo se reembolsan pagos PAGADOS (este está ${payment.status})`);
    await recomputeOrderPaymentStatus(tx, payment.orderId);
  });
  return getPayment(id);
}

export async function listPayments(filters) {
  const { method, status, source, orderId, from, to, page, pageSize } = filters;
  const createdAt = {
    ...(from && { gte: localDayRange(from).start }),
    ...(to && { lt: localDayRange(to).end }),
  };
  const where = {
    ...(method && { method }),
    ...(status && { status }),
    ...(orderId && { orderId }),
    ...(source && { order: { source } }),
    ...((from || to) && { createdAt }),
  };

  const [total, data, collected] = await prisma.$transaction([
    prisma.payment.count({ where }),
    prisma.payment.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.payment.aggregate({ where: { ...where, status: 'PAGADO' }, _sum: { amount: true }, _count: { _all: true } }),
  ]);

  return {
    data,
    summary: { collected: collected._sum.amount ?? ZERO, payments: collected._count._all },
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function getPayment(id) {
  const payment = await prisma.payment.findUnique({ where: { id }, include });
  if (!payment) throw AppError.notFound('Pago no encontrado');
  return payment;
}
