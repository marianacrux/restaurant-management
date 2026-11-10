import { z } from 'zod';
import { booleanQuery, moneySchema } from '../../utils/validation.js';

// URL absoluta (http/https) o ruta local (/uploads/...). Preparado para,
// más adelante, guardar URLs de un almacenamiento externo (S3, Cloudinary...).
const imageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https?:\/\/\S+$/.test(v) || v.startsWith('/'), 'Debe ser una URL http(s) o una ruta local');

export const productBodySchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120),
  description: z.string().trim().max(500).nullish(),
  price: moneySchema.refine((v) => v > 0, 'El precio debe ser mayor que cero'),
  imageUrl: imageUrlSchema.nullish(),
  categoryId: z.coerce.number().int().positive('Seleccione una categoría'),
  available: z.boolean().optional(),
  isDailyMenu: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const productUpdateSchema = productBodySchema.partial();

export const availabilitySchema = z.object({
  available: z.boolean({ error: 'available debe ser true o false' }),
});

export const productListQuerySchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  available: booleanQuery.optional(),
  dailyMenu: booleanQuery.optional(),
  featured: booleanQuery.optional(),
  search: z.string().trim().max(80).optional(),
  includeInactive: booleanQuery.optional(),
});
