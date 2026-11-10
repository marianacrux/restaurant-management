import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import * as service from './screen.service.js';

const router = Router();

const numberParam = z.object({ number: z.coerce.number().int().min(1).max(20) });
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => !v || /^https?:\/\/\S+$/.test(v) || v.startsWith('/'), 'URL de imagen inválida')
  .nullish();

const itemSchema = z
  .object({
    contentType: z.enum(['PRODUCTO', 'PROMOCION', 'ANUNCIO']),
    productId: z.coerce.number().int().positive().nullish(),
    promotionId: z.coerce.number().int().positive().nullish(),
    title: z.string().trim().max(120).nullish(),
    description: z.string().trim().max(300).nullish(),
    imageUrl: optionalUrl,
    active: z.boolean().optional(),
  })
  .superRefine((i, ctx) => {
    if (i.contentType === 'PRODUCTO' && !i.productId) ctx.addIssue({ code: 'custom', path: ['productId'], message: 'Seleccione el producto' });
    if (i.contentType === 'PROMOCION' && !i.promotionId) ctx.addIssue({ code: 'custom', path: ['promotionId'], message: 'Seleccione la promoción' });
    if (i.contentType === 'ANUNCIO' && !i.title) ctx.addIssue({ code: 'custom', path: ['title'], message: 'El anuncio necesita un título' });
  });

const contentBody = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(200).nullish(),
  active: z.boolean().optional(),
  items: z.array(itemSchema).max(40, 'Máximo 40 elementos por pantalla'),
});

// ---- Público: lo consultan los televisores del restaurante (sin sesión).
router.get('/:number/content', validate({ params: numberParam }), async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await service.getScreenDisplay(req.valid.params.number));
});

// ---- Administración
router.get('/', authenticate, authorize('ADMIN'), async (_req, res) => {
  res.json(await service.listScreens());
});

router.get('/:number/config', authenticate, authorize('ADMIN'), validate({ params: numberParam }), async (req, res) => {
  res.json(await service.getScreenConfig(req.valid.params.number));
});

router.put('/:number/content', authenticate, authorize('ADMIN'), validate({ params: numberParam, body: contentBody }), async (req, res) => {
  res.json(await service.replaceScreenContent(req.valid.params.number, req.valid.body));
});

export default router;
