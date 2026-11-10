import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize, optionalAuth } from '../../middlewares/auth.js';
import { idParamSchema } from '../../utils/validation.js';
import { categoryBodySchema, categoryListQuerySchema, categoryUpdateSchema } from './category.validator.js';
import * as controller from './category.controller.js';

const router = Router();

// Lectura pública: la usan el menú digital, las pantallas y el bot.
router.get('/', optionalAuth, validate({ query: categoryListQuerySchema }), controller.list);
router.post('/', authenticate, authorize('ADMIN'), validate({ body: categoryBodySchema }), controller.create);
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validate({ params: idParamSchema, body: categoryUpdateSchema }),
  controller.update,
);

export default router;
