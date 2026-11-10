import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { localDayRange } from '../../utils/dates.js';
import { ACTIVE_DELIVERY_STATUSES } from '../deliveries/delivery.helpers.js';

const include = {
  user: { select: { id: true, email: true } },
  deliveries: {
    where: { status: { in: ACTIVE_DELIVERY_STATUSES } },
    select: { id: true, status: true, assignedAt: true, order: { select: { id: true, orderNumber: true, deliveryAddress: true } } },
  },
};

/** Lista domiciliarios con su entrega en curso y cuántas entregas hizo hoy. */
export async function listDeliveryPersons({ availability, includeInactive = false } = {}) {
  const { start, end } = localDayRange();
  const [persons, deliveredToday] = await prisma.$transaction([
    prisma.deliveryPerson.findMany({
      where: { ...(includeInactive ? {} : { active: true }), ...(availability && { availability }) },
      include,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    }),
    prisma.delivery.groupBy({
      by: ['deliveryPersonId'],
      where: { status: 'ENTREGADO', deliveredAt: { gte: start, lt: end } },
      _count: { _all: true },
      orderBy: { deliveryPersonId: 'asc' },
    }),
  ]);
  const counts = new Map(deliveredToday.map((r) => [r.deliveryPersonId, r._count._all]));
  return persons.map(({ deliveries, ...p }) => ({
    ...p,
    activeDelivery: deliveries[0] ?? null,
    deliveredToday: counts.get(p.id) ?? 0,
  }));
}

async function getPersonOrFail(id, db = prisma) {
  const person = await db.deliveryPerson.findUnique({ where: { id } });
  if (!person) throw AppError.notFound('Domiciliario no encontrado');
  return person;
}

async function assertUserIsCourier(userId) {
  if (!userId) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || user.role !== 'DOMICILIARIO') throw AppError.badRequest('El usuario vinculado debe tener rol DOMICILIARIO');
}

export async function createDeliveryPerson(data) {
  await assertUserIsCourier(data.userId);
  return prisma.deliveryPerson.create({ data: { ...data, availability: 'DISPONIBLE' } });
}

export async function updateDeliveryPerson(id, data) {
  const person = await getPersonOrFail(id);
  await assertUserIsCourier(data.userId);
  if (data.active === false && person.availability === 'OCUPADO') {
    throw AppError.conflict('No se puede desactivar: tiene una entrega en curso');
  }
  return prisma.deliveryPerson.update({
    where: { id },
    data: { ...data, ...(data.active === false && { availability: 'INACTIVO' }) },
  });
}

/** Activa (DISPONIBLE) o pone en descanso (INACTIVO). Nunca mientras está en una entrega. */
export async function setAvailability(id, availability) {
  const person = await getPersonOrFail(id);
  if (!person.active) throw AppError.conflict('El domiciliario está desactivado');
  if (person.availability === 'OCUPADO') {
    throw AppError.conflict(`${person.name} tiene una entrega en curso; quedará disponible al confirmarla`);
  }
  return prisma.deliveryPerson.update({ where: { id }, data: { availability } });
}
