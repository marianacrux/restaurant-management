// Indicadores del dashboard. Todo sale de consultas reales a PostgreSQL.
// Regla: un pedido CANCELADO nunca suma como venta.
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { addDays, listLocalDays, localDayRange, todayLocal, BUSINESS_TIMEZONE } from '../../utils/dates.js';

const ZERO = new Prisma.Decimal(0);
const ORDER_STATUSES = ['PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO'];
const SOURCES = ['WHATSAPP', 'VITRINA', 'PUNTO_DE_VENTA', 'DOMICILIO'];
const PAYMENT_METHODS = ['EFECTIVO', 'TRANSFERENCIA', 'NEQUI', 'DAVIPLATA', 'TARJETA', 'CONTRAENTREGA_EFECTIVO'];

export async function getSummary(day = todayLocal()) {
  const { start, end } = localDayRange(day);
  const inDay = { createdAt: { gte: start, lt: end } };
  const notCancelled = { ...inDay, status: { not: 'CANCELADO' } };

  const [byStatus, bySource, sales, delivered, pendingPayment, payments] = await prisma.$transaction([
    prisma.order.groupBy({ by: ['status'], where: inDay, _count: { _all: true }, orderBy: { status: 'asc' } }),
    prisma.order.groupBy({ by: ['source'], where: notCancelled, _count: { _all: true }, _sum: { total: true }, orderBy: { source: 'asc' } }),
    prisma.order.aggregate({ where: notCancelled, _count: { _all: true }, _sum: { total: true } }),
    prisma.order.aggregate({ where: { ...inDay, status: 'ENTREGADO' }, _sum: { total: true } }),
    prisma.order.aggregate({ where: { ...notCancelled, paymentStatus: { in: ['PENDIENTE', 'PARCIAL'] } }, _count: { _all: true }, _sum: { total: true } }),
    prisma.payment.groupBy({ by: ['method'], where: { ...inDay, status: 'PAGADO' }, _count: { _all: true }, _sum: { amount: true }, orderBy: { method: 'asc' } }),
  ]);

  const statusCounts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
  for (const row of byStatus) statusCounts[row.status] = row._count._all;

  const sourceStats = SOURCES.map((source) => {
    const row = bySource.find((r) => r.source === source);
    return { source, orders: row?._count._all ?? 0, total: row?._sum.total ?? ZERO };
  });

  const paymentStats = PAYMENT_METHODS.map((method) => {
    const row = payments.find((r) => r.method === method);
    return { method, payments: row?._count._all ?? 0, total: row?._sum.amount ?? ZERO };
  });

  const salesTotal = sales._sum.total ?? ZERO;
  const validOrders = sales._count._all;

  return {
    day,
    sales: {
      total: salesTotal, // pedidos del día no cancelados
      delivered: delivered._sum.total ?? ZERO, // ventas completadas (ENTREGADO)
      collected: paymentStats.reduce((sum, p) => sum.add(p.total), ZERO), // dinero efectivamente registrado
      averageTicket: validOrders ? salesTotal.div(validOrders).toDecimalPlaces(0) : ZERO,
    },
    orders: {
      total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      byStatus: statusCounts,
    },
    pendingPayments: { orders: pendingPayment._count._all, amount: pendingPayment._sum.total ?? ZERO },
    bySource: sourceStats,
    byPaymentMethod: paymentStats,
  };
}

/** Ventas por día (pedidos no cancelados) para el gráfico. */
export async function getSalesByDay({ from, to } = {}) {
  const toDay = to ?? todayLocal();
  const fromDay = from ?? addDays(toDay, -6);
  const { start } = localDayRange(fromDay);
  const { end } = localDayRange(toDay);

  // Prisma guarda createdAt como "timestamp sin zona" en UTC. Las conversiones
  // explícitas evitan que PostgreSQL aplique la zona horaria de la sesión.
  const rows = await prisma.$queryRaw`
    SELECT to_char(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${BUSINESS_TIMEZONE})::date, 'YYYY-MM-DD') AS day,
           count(*)::int AS orders,
           coalesce(sum(total), 0) AS total
    FROM "Order"
    WHERE "createdAt" >= (${start}::timestamptz AT TIME ZONE 'UTC')
      AND "createdAt" <  (${end}::timestamptz AT TIME ZONE 'UTC')
      AND status <> 'CANCELADO'
    GROUP BY 1 ORDER BY 1`;

  const byDay = new Map(rows.map((r) => [r.day, r]));
  return listLocalDays(fromDay, toDay).map((day) => ({
    day,
    orders: byDay.get(day)?.orders ?? 0,
    total: byDay.get(day)?.total ?? ZERO,
  }));
}
