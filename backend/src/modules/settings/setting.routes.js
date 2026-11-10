import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { getPublicSettings } from './setting.service.js';

const router = Router();

// Parámetros que el frontend necesita (p. ej. mostrar el costo del domicilio en el POS).
router.get('/', authenticate, async (_req, res) => {
  res.json(await getPublicSettings());
});

export default router;
