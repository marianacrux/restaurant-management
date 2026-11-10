import { z } from 'zod';
import { OrderSource, PaymentMethod, PaymentStatus } from '@prisma/client';
import { moneySchema, prismaEnum } from '../../utils/validation.js';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha: AAAA-MM-DD');

export const createPaymentSchema = z.object({
  orderId: z.coerce.number().int().positive('Pedido inválido'),
  method: prismaEnum(PaymentMethod),
  amount: moneySchema.refine((v) => v > 0, 'El monto debe ser mayor que cero'),
  reference: z.string().trim().max(100).nullish(),
  notes: z.string().trim().max(300).nullish(),
});

export const refundSchema = z.object({
  status: z.literal('REEMBOLSADO', { error: 'Solo se admite status REEMBOLSADO' }),
  notes: z.string().trim().min(3, 'Indique el motivo del reembolso').max(300),
});

export const listPaymentsQuerySchema = z
  .object({
    method: prismaEnum(PaymentMethod).optional(),
    status: prismaEnum(PaymentStatus).optional(),
    source: prismaEnum(OrderSource).optional(),
    orderId: z.coerce.number().int().positive().optional(),
    from: day.optional(),
    to: day.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(30),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, '"from" debe ser anterior a "to"');
