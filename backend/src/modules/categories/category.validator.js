import { z } from 'zod';
import { booleanQuery } from '../../utils/validation.js';

export const categoryBodySchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80),
  description: z.string().trim().max(300).nullish(),
  position: z.coerce.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const categoryUpdateSchema = categoryBodySchema.partial();

export const categoryListQuerySchema = z.object({
  includeInactive: booleanQuery.optional(),
});
