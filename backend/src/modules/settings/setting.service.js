// Parámetros del negocio editables por el administrador (tabla Setting).
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';

export const SETTING_KEYS = Object.freeze({
  DELIVERY_FEE: 'DELIVERY_FEE',
  RESTAURANT_NAME: 'RESTAURANT_NAME',
});

const DEFAULT_DELIVERY_FEE = '5000';

/** Costo fijo del domicilio. Acepta un cliente de transacción opcional. */
export async function getDeliveryFee(db = prisma) {
  const setting = await db.setting.findUnique({ where: { key: SETTING_KEYS.DELIVERY_FEE } });
  return new Prisma.Decimal(setting?.value ?? DEFAULT_DELIVERY_FEE);
}
