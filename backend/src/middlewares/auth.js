// Autenticación (¿quién es?) y autorización (¿puede hacerlo?).
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';

const PUBLIC_USER_FIELDS = { id: true, name: true, email: true, role: true, active: true };

async function resolveUser(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw AppError.unauthorized('Sesión inválida o expirada');
  }

  // Se consulta la BD en cada petición: un usuario desactivado pierde
  // el acceso de inmediato aunque su token siga vigente.
  const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) }, select: PUBLIC_USER_FIELDS });
  if (!user || !user.active) throw AppError.unauthorized('Usuario inactivo o inexistente');
  return user;
}

/** Exige un token válido. Deja el usuario en req.user. */
export async function authenticate(req, _res, next) {
  const user = await resolveUser(req);
  if (!user) throw AppError.unauthorized('Debe iniciar sesión');
  req.user = user;
  next();
}

/** Si hay token lo valida; si no, continúa como anónimo (rutas públicas como el menú). */
export async function optionalAuth(req, _res, next) {
  req.user = await resolveUser(req);
  next();
}

/** Restringe la ruta a ciertos roles. Usar después de authenticate. */
export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) throw AppError.unauthorized('Debe iniciar sesión');
    if (!roles.includes(req.user.role)) throw AppError.forbidden();
    next();
  };
}
