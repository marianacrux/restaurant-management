// Pantallas digitales. Cada pantalla tiene una lista ordenada de contenidos:
// PRODUCTO (precio y disponibilidad se leen EN VIVO del catálogo),
// PROMOCION (con su precio con descuento calculado aquí) o ANUNCIO (texto/imagen libre).
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { getPublicSettings } from '../settings/setting.service.js';

const productSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  imageUrl: true,
  available: true,
  active: true,
  category: { select: { name: true } },
};

/** Precio final de una promoción ligada a un producto (nunca negativo). */
function promoPrice(promotion) {
  if (!promotion.product) return null;
  const price = new Prisma.Decimal(promotion.product.price);
  const value = new Prisma.Decimal(promotion.discountValue);
  const final = promotion.discountType === 'PORCENTAJE' ? price.mul(new Prisma.Decimal(100).sub(value)).div(100) : price.sub(value);
  return Prisma.Decimal.max(final, 0).toDecimalPlaces(0);
}

const isPromotionLive = (p, now = new Date()) => p.active && p.startDate <= now && p.endDate >= now;

async function getScreenOrFail(screenNumber) {
  const screen = await prisma.menuScreen.findUnique({ where: { screenNumber } });
  if (!screen) throw AppError.notFound(`La pantalla ${screenNumber} no existe`);
  return screen;
}

export async function listScreens() {
  return prisma.menuScreen.findMany({
    orderBy: { screenNumber: 'asc' },
    include: { _count: { select: { contents: { where: { active: true } } } } },
  });
}

/**
 * Contenido listo para mostrar (ruta PÚBLICA: los televisores no inician sesión).
 * Omite productos retirados y promociones vencidas; los agotados se muestran marcados.
 */
export async function getScreenDisplay(screenNumber) {
  const screen = await getScreenOrFail(screenNumber);
  const [contents, settings] = await Promise.all([
    prisma.screenContent.findMany({
      where: { screenId: screen.id, active: true },
      orderBy: { position: 'asc' },
      include: { product: { select: productSelect }, promotion: { include: { product: { select: productSelect } } } },
    }),
    getPublicSettings(),
  ]);

  const items = [];
  for (const c of contents) {
    if (c.contentType === 'PRODUCTO') {
      if (!c.product?.active) continue;
      items.push({
        id: c.id,
        type: 'PRODUCTO',
        title: c.title || c.product.name,
        description: c.description || c.product.description,
        imageUrl: c.imageUrl || c.product.imageUrl,
        price: c.product.price,
        available: c.product.available,
        category: c.product.category.name,
      });
    } else if (c.contentType === 'PROMOCION') {
      if (!c.promotion || !isPromotionLive(c.promotion)) continue;
      const p = c.promotion;
      items.push({
        id: c.id,
        type: 'PROMOCION',
        title: c.title || p.name,
        description: c.description || p.description,
        imageUrl: c.imageUrl || p.imageUrl || p.product?.imageUrl || null,
        discountType: p.discountType,
        discountValue: p.discountValue,
        regularPrice: p.product?.price ?? null,
        price: promoPrice(p),
        available: p.product ? p.product.active && p.product.available : true,
        endDate: p.endDate,
      });
    } else {
      items.push({ id: c.id, type: 'ANUNCIO', title: c.title, description: c.description, imageUrl: c.imageUrl });
    }
  }

  return {
    screen: { number: screen.screenNumber, name: screen.name, description: screen.description, active: screen.active },
    restaurantName: settings.restaurantName,
    items,
    generatedAt: new Date().toISOString(),
  };
}

/** Configuración editable (para el panel administrativo). */
export async function getScreenConfig(screenNumber) {
  const screen = await getScreenOrFail(screenNumber);
  const contents = await prisma.screenContent.findMany({
    where: { screenId: screen.id },
    orderBy: { position: 'asc' },
    include: {
      product: { select: { id: true, name: true, price: true, available: true, active: true } },
      promotion: { select: { id: true, name: true, active: true, endDate: true } },
    },
  });
  return { ...screen, contents };
}

/** Reemplaza el contenido de una pantalla en una sola transacción. */
export async function replaceScreenContent(screenNumber, { name, description, active, items }) {
  const screen = await getScreenOrFail(screenNumber);

  const productIds = items.filter((i) => i.contentType === 'PRODUCTO').map((i) => i.productId);
  const promotionIds = items.filter((i) => i.contentType === 'PROMOCION').map((i) => i.promotionId);
  const [products, promotions] = await Promise.all([
    prisma.product.count({ where: { id: { in: productIds } } }),
    prisma.promotion.count({ where: { id: { in: promotionIds } } }),
  ]);
  if (products !== new Set(productIds).size) throw AppError.badRequest('Algún producto seleccionado no existe');
  if (promotions !== new Set(promotionIds).size) throw AppError.badRequest('Alguna promoción seleccionada no existe');

  await prisma.$transaction([
    prisma.menuScreen.update({
      where: { id: screen.id },
      data: { ...(name && { name }), ...(description !== undefined && { description }), ...(active !== undefined && { active }) },
    }),
    prisma.screenContent.deleteMany({ where: { screenId: screen.id } }),
    prisma.screenContent.createMany({
      data: items.map((item, index) => ({
        screenId: screen.id,
        contentType: item.contentType,
        productId: item.contentType === 'PRODUCTO' ? item.productId : null,
        promotionId: item.contentType === 'PROMOCION' ? item.promotionId : null,
        title: item.title || null,
        description: item.description || null,
        imageUrl: item.imageUrl || null,
        position: index,
        active: item.active ?? true,
      })),
    }),
  ]);

  return getScreenConfig(screenNumber);
}

export async function listPromotions() {
  const promotions = await prisma.promotion.findMany({
    orderBy: [{ active: 'desc' }, { endDate: 'desc' }],
    include: { product: { select: { id: true, name: true, price: true } } },
  });
  return promotions.map((p) => ({ ...p, live: isPromotionLive(p), finalPrice: promoPrice(p) }));
}
