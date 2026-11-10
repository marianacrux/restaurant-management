import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { listPromotions } from './screen.service.js';

// Por ahora solo lectura (para elegir promociones en las pantallas).
// La gestión completa de promociones está planeada para la siguiente etapa.
const router = Router();

router.get('/', authenticate, authorize('ADMIN', 'CAJERO'), async (_req, res) => {
  res.json(await listPromotions());
});

export default router;
