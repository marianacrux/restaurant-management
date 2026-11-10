import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize, optionalAuth } from '../../middlewares/auth.js';
import { idParamSchema } from '../../utils/validation.js';
import {
  availabilitySchema,
  productBodySchema,
  productListQuerySchema,
  productUpdateSchema,
} from './product.validator.js';
import * as controller from './product.controller.js';

const router = Router();
const byId = { params: idParamSchema };

// Lectura pública (menú digital, pantallas, bot de WhatsApp).
router.get('/', optionalAuth, validate({ query: productListQuerySchema }), controller.list);
router.get('/:id', optionalAuth, validate(byId), controller.getById);

// Gestión del catálogo: solo administrador.
router.post('/', authenticate, authorize('ADMIN'), validate({ body: productBodySchema }), controller.create);
router.put('/:id', authenticate, authorize('ADMIN'), validate({ ...byId, body: productUpdateSchema }), controller.update);
router.delete('/:id', authenticate, authorize('ADMIN'), validate(byId), controller.remove);

// Marcar agotado: también caja y cocina (son quienes se enteran primero).
router.patch(
  '/:id/availability',
  authenticate,
  authorize('ADMIN', 'CAJERO', 'COCINA'),
  validate({ ...byId, body: availabilitySchema }),
  controller.setAvailability,
);

export default router;
