import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../../middlewares/auth.js';
import { loginSchema } from './auth.validator.js';
import * as controller from './auth.controller.js';

const router = Router();

router.post('/login', validate({ body: loginSchema }), controller.login);
router.get('/me', authenticate, controller.me);

export default router;
