// Cálculo de líneas y totales. ÚNICA fuente de verdad de los precios:
// se leen del catálogo en la BD, nunca de lo que envía el cliente.
import { Prisma } from '@prisma/client';
import { AppError } from '../../utils/AppError.js';

const ZERO = new Prisma.Decimal(0);

/**
 * Convierte los ítems solicitados en líneas de pedido con precio "congelado".
 * Lanza 409 con el detalle si algún producto no existe, está inactivo o agotado.
 * @param {Prisma.TransactionClient} tx
 * @param {{productId:number, quantity:number, notes?:string}[]} items
 */
export async function buildOrderLines(tx, items) {
  const ids = [...new Set(items.map((i) => i.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: ids } },
    include: { category: { select: { active: true } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const problems = [];
  for (const id of ids) {
    const p = byId.get(id);
    if (!p || !p.active || !p.category.active) problems.push({ productId: id, reason: 'NO_EXISTE', message: `El producto #${id} no existe o fue retirado del menú` });
    else if (!p.available) problems.push({ productId: id, reason: 'AGOTADO', message: `"${p.name}" está agotado` });
  }
  if (problems.length) {
    throw AppError.conflict(problems.map((p) => p.message).join('. '), problems);
  }

  const lines = items.map((item) => {
    const product = byId.get(item.productId);
    return {
      productId: product.id,
      productName: product.name, // copia histórica
      unitPrice: product.price, // copia histórica
      quantity: item.quantity,
      notes: item.notes || null,
      subtotal: product.price.mul(item.quantity),
    };
  });

  const subtotal = lines.reduce((sum, l) => sum.add(l.subtotal), ZERO);
  return { lines, subtotal };
}

/** total = subtotal - descuento + domicilio (nunca negativo). */
export function computeTotal({ subtotal, discount = ZERO, deliveryFee = ZERO }) {
  const total = new Prisma.Decimal(subtotal).sub(discount).add(deliveryFee);
  return total.isNegative() ? ZERO : total;
}
