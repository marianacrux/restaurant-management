import { z } from 'zod';
import { TransportType } from '@prisma/client';
import { booleanQuery, phoneSchema, prismaEnum } from '../../utils/validation.js';

export const deliveryPersonBodySchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120),
  phone: phoneSchema,
  transportType: prismaEnum(TransportType),
  userId: z.coerce.number().int().positive().nullish(),
});

export const deliveryPersonUpdateSchema = deliveryPersonBodySchema.partial().extend({
  active: z.boolean().optional(),
});

// OCUPADO lo asigna el sistema al despachar; manualmente solo se alterna DISPONIBLE / INACTIVO.
export const availabilitySchema = z.object({
  availability: z.enum(['DISPONIBLE', 'INACTIVO'], { error: 'Disponibilidad: DISPONIBLE o INACTIVO' }),
});

export const deliveryPersonListQuerySchema = z.object({
  availability: z.enum(['DISPONIBLE', 'OCUPADO', 'INACTIVO']).optional(),
  includeInactive: booleanQuery.optional(),
});
