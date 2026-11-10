import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';

const productInclude = { category: { select: { id: true, name: true } } };

/**
 * Catálogo único para TODOS los canales (admin, POS, bot, pantallas).
 * Por defecto solo devuelve productos activos de categorías activas.
 */
export async function listProducts(filters = {}) {
  const { categoryId, available, dailyMenu, featured, search, includeInactive = false } = filters;

  const where = {
    ...(includeInactive ? {} : { active: true, category: { active: true } }),
    ...(categoryId && { categoryId }),
    ...(available !== undefined && { available }),
    ...(dailyMenu !== undefined && { isDailyMenu: dailyMenu }),
    ...(featured !== undefined && { isFeatured: featured }),
    ...(search && { name: { contains: search, mode: 'insensitive' } }),
  };

  return prisma.product.findMany({
    where,
    include: productInclude,
    orderBy: [{ category: { position: 'asc' } }, { name: 'asc' }],
  });
}

export async function getProduct(id, { includeInactive = false } = {}) {
  const product = await prisma.product.findUnique({ where: { id }, include: productInclude });
  if (!product || (!includeInactive && !product.active)) throw AppError.notFound('Producto no encontrado');
  return product;
}

async function assertCategoryExists(categoryId) {
  if (categoryId === undefined) return;
  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!category) throw AppError.badRequest('La categoría seleccionada no existe');
}

export async function createProduct(data) {
  await assertCategoryExists(data.categoryId);
  return prisma.product.create({ data, include: productInclude });
}

export async function updateProduct(id, data) {
  await getProduct(id, { includeInactive: true });
  await assertCategoryExists(data.categoryId);
  return prisma.product.update({ where: { id }, data, include: productInclude });
}

/** Marca un producto como disponible o AGOTADO. Afecta a todos los canales. */
export async function setAvailability(id, available) {
  await getProduct(id);
  return prisma.product.update({ where: { id }, data: { available }, include: productInclude });
}

/**
 * "Eliminar" = desactivar (soft delete). El producto deja de aparecer en el
 * catálogo, pero los pedidos antiguos conservan su historial intacto.
 */
export async function deactivateProduct(id) {
  await getProduct(id, { includeInactive: true });
  return prisma.product.update({ where: { id }, data: { active: false }, include: productInclude });
}
