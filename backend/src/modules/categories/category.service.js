import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';

export async function listCategories({ includeInactive = false } = {}) {
  return prisma.category.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { products: { where: { active: true } } } } },
  });
}

export async function createCategory(data) {
  return prisma.category.create({ data });
}

export async function updateCategory(id, data) {
  const exists = await prisma.category.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw AppError.notFound('Categoría no encontrada');
  return prisma.category.update({ where: { id }, data });
}
