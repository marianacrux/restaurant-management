import { Router } from 'express';
import { z } from 'zod';
import { DeliveryStatus } from '@prisma/client';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { idParamSchema, prismaEnum } from '../../utils/validation.js';
import * as service from './delivery.service.js';

const router = Router();
router.use(authenticate);

const listQuery = z.object({
  status: z
    .string()
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(prismaEnum(DeliveryStatus)).min(1))
    .optional(),
  deliveryPersonId: z.coerce.number().int().positive().optional(),
});

const assignBody = z.object({
  orderId: z.coerce.number().int().positive('Pedido inválido'),
  deliveryPersonId: z.coerce.number().int().positive('Seleccione un domiciliario'),
});

// Por ahora la única transición manual es confirmar la entrega.
const statusBody = z.object({ status: z.literal('ENTREGADO', { error: 'Solo se admite status ENTREGADO' }) });

router.get('/', authorize('ADMIN', 'CAJERO', 'DOMICILIARIO'), validate({ query: listQuery }), async (req, res) => {
  res.json(await service.listDeliveries(req.valid.query, req.user));
});

router.post('/assign', authorize('ADMIN', 'CAJERO'), validate({ body: assignBody }), async (req, res) => {
  res.status(201).json(await service.assignDelivery(req.valid.body, req.user));
});

router.patch(
  '/:id/status',
  authorize('ADMIN', 'CAJERO', 'DOMICILIARIO'),
  validate({ params: idParamSchema, body: statusBody }),
  async (req, res) => {
    res.json(await service.completeDelivery(req.valid.params.id, req.user));
  },
);

export default router;
