// Manejo centralizado de errores. Express 5 reenvía aquí automáticamente
// los errores de funciones async (no hace falta try/catch en cada controlador).
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, _res, next) {
  next(AppError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un registro con esos datos', details: err.meta });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Recurso no encontrado' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({ error: 'El registro está relacionado con otros datos' });
    }
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON mal formado' });
  }

  console.error(err);
  return res.status(500).json({
    error: 'Error interno del servidor',
    ...(env.isProduction ? {} : { details: err.message }),
  });
}
