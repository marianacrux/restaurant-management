// SIMULADOR de WhatsApp (no envía mensajes reales). Lo usa la pantalla
// "Simulador de WhatsApp" del panel para probar el flujo completo del bot.
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { processMessage, startSession } from './bot.service.js';

const router = Router();
router.use(authenticate, authorize('ADMIN', 'CAJERO'));

const sessionBody = z.object({
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, ''))
    .refine((v) => /^3\d{9}$/.test(v), 'Celular de 10 dígitos')
    .optional(),
});
const messageBody = z.object({
  sessionId: z.uuid('Sesión inválida'),
  text: z.string().trim().min(1, 'Mensaje vacío').max(500),
});

router.post('/session', validate({ body: sessionBody }), async (req, res) => {
  res.status(201).json(await startSession({ channel: 'SIMULADOR', phone: req.valid.body.phone ?? null }));
});

router.post('/message', validate({ body: messageBody }), async (req, res) => {
  res.json(await processMessage(req.valid.body.sessionId, req.valid.body.text));
});

// Atajo equivalente a responder "SI" en el paso de confirmación.
router.post('/confirm', validate({ body: z.object({ sessionId: z.uuid('Sesión inválida') }) }), async (req, res) => {
  res.json(await processMessage(req.valid.body.sessionId, 'SI'));
});

export default router;
