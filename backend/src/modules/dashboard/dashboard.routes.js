import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import * as service from './dashboard.service.js';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha: AAAA-MM-DD');

const router = Router();
router.use(authenticate, authorize('ADMIN', 'CAJERO'));

router.get('/summary', validate({ query: z.object({ date: day.optional() }) }), async (req, res) => {
  res.json(await service.getSummary(req.valid.query.date));
});

router.get(
  '/sales',
  validate({ query: z.object({ from: day.optional(), to: day.optional() }).refine((q) => !q.from || !q.to || q.from <= q.to, '"from" debe ser anterior a "to"') }),
  async (req, res) => {
    res.json(await service.getSalesByDay(req.valid.query));
  },
);

export default router;
