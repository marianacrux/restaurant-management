import { z } from 'zod';
import { OrderSource, OrderStatus, OrderType, PaymentMethod, PaymentStatus } from '@prisma/client';
import { phoneSchema, prismaEnum } from '../../utils/validation.js';

const customerSchema = z.object({
  name: z.string().trim().min(2, 'Nombre del cliente: mínimo 2 caracteres').max(120),
  phone: phoneSchema,
});

export const orderItemInputSchema = z.object({
  productId: z.coerce.number().int().positive('Producto inválido'),
  quantity: z.coerce.number().int('La cantidad debe ser entera').min(1, 'Mínimo 1').max(99, 'Máximo 99'),
  notes: z.string().trim().max(200).nullish(),
});

const itemsSchema = z.array(orderItemInputSchema).min(1, 'El pedido debe tener al menos un producto').max(50);

// IMPORTANTE: no se aceptan precios ni totales. El backend los calcula.
export const createOrderSchema = z
  .object({
    source: prismaEnum(OrderSource),
    type: prismaEnum(OrderType).optional(),
    customer: customerSchema.nullish(),
    items: itemsSchema,
    paymentMethod: prismaEnum(PaymentMethod).nullish(),
    deliveryAddress: z.string().trim().min(5, 'Dirección muy corta').max(250).nullish(),
    notes: z.string().trim().max(500).nullish(),
    confirm: z.boolean().default(true), // false = queda PENDIENTE para revisión
  })
  .transform((o) => ({
    ...o,
    // Un pedido del canal DOMICILIO siempre se entrega a domicilio.
    type: o.source === 'DOMICILIO' ? 'DOMICILIO' : (o.type ?? 'EN_LOCAL'),
  }))
  .superRefine((o, ctx) => {
    if (o.type === 'DOMICILIO') {
      if (!o.deliveryAddress) ctx.addIssue({ code: 'custom', path: ['deliveryAddress'], message: 'La dirección es obligatoria para domicilios' });
      if (!o.customer) ctx.addIssue({ code: 'custom', path: ['customer'], message: 'Los datos del cliente son obligatorios para domicilios' });
    } else if (o.deliveryAddress) {
      ctx.addIssue({ code: 'custom', path: ['deliveryAddress'], message: 'Solo los pedidos a domicilio llevan dirección' });
    }
    if (o.source === 'WHATSAPP' && !o.customer) {
      ctx.addIssue({ code: 'custom', path: ['customer'], message: 'Los pedidos de WhatsApp requieren nombre y teléfono' });
    }
  });

export const addItemsSchema = z.object({ items: itemsSchema });

export const updateOrderSchema = z
  .object({
    notes: z.string().trim().max(500).nullish(),
    deliveryAddress: z.string().trim().min(5, 'Dirección muy corta').max(250).optional(),
    paymentMethod: prismaEnum(PaymentMethod).nullish(),
  })
  .refine((o) => Object.keys(o).length > 0, 'Debe enviar al menos un campo para actualizar');

export const changeStatusSchema = z
  .object({
    status: prismaEnum(OrderStatus),
    note: z.string().trim().max(300).optional(),
    cancelReason: z.string().trim().min(3, 'Indique el motivo de la cancelación').max(300).optional(),
  })
  .refine((o) => o.status !== 'CANCELADO' || o.cancelReason, {
    path: ['cancelReason'],
    message: 'El motivo es obligatorio al cancelar',
  });

/** "A,B" -> ['A','B'] validando contra el enum. */
const csvEnum = (enumObject) =>
  z
    .string()
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(prismaEnum(enumObject)).min(1));

export const listOrdersQuerySchema = z.object({
  status: csvEnum(OrderStatus).optional(),
  source: csvEnum(OrderSource).optional(),
  type: csvEnum(OrderType).optional(),
  paymentStatus: csvEnum(PaymentStatus).optional(),
  from: z.coerce.date({ error: 'Fecha "from" inválida' }).optional(),
  to: z.coerce.date({ error: 'Fecha "to" inválida' }).optional(),
  search: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
