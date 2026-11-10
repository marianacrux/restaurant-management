import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { idParamSchema } from '../../utils/validation.js';
import { createPaymentSchema, listPaymentsQuerySchema, refundSchema } from './payment.validator.js';
import * as service from './payment.service.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('ADMIN', 'CAJERO'), validate({ query: listPaymentsQuerySchema }), async (req, res) => {
  res.json(await service.listPayments(req.valid.query));
});

router.post('/', authorize('ADMIN', 'CAJERO'), validate({ body: createPaymentSchema }), async (req, res) => {
  res.status(201).json(await service.registerPayment(req.valid.body, req.user));
});

// Reembolsos: solo el administrador.
router.patch('/:id', authorize('ADMIN'), validate({ params: idParamSchema, body: refundSchema }), async (req, res) => {
  res.json(await service.refundPayment(req.valid.params.id, req.valid.body, req.user));
});

export default router;
