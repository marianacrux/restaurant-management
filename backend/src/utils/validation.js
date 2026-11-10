// Esquemas zod reutilizables entre módulos.
import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.coerce.number({ error: 'El id debe ser numérico' }).int().positive('El id debe ser un número positivo'),
});

/** Convierte un objeto enum de Prisma ({A:'A', B:'B'}) en z.enum. */
export const prismaEnum = (enumObject) => z.enum(Object.values(enumObject));

/** "true"/"false" en query string -> boolean. */
export const booleanQuery = z.enum(['true', 'false']).transform((v) => v === 'true');

/** Teléfono colombiano: 10 dígitos (se ignoran espacios, guiones y +57). */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, '').replace(/^\+?57/, ''))
  .refine((v) => /^\d{10}$/.test(v), 'El teléfono debe tener 10 dígitos');

/** Dinero positivo con máximo 2 decimales (se recibe como número o texto). */
export const moneySchema = z.coerce
  .number({ error: 'Debe ser un valor numérico' })
  .nonnegative('No puede ser negativo')
  .max(99_999_999, 'Valor demasiado alto')
  .refine((v) => /^-?\d+(\.\d{1,2})?$/.test(String(v)), 'Máximo 2 decimales');
