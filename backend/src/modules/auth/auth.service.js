import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

// Hash fijo para comparar cuando el correo no existe: así la respuesta tarda
// lo mismo y no se puede averiguar qué correos están registrados.
const DUMMY_HASH = bcrypt.hashSync('usuario-inexistente', 10);

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid) throw AppError.unauthorized('Correo o contraseña incorrectos');
  if (!user.active) throw AppError.forbidden('El usuario está desactivado');

  const token = jwt.sign({ sub: String(user.id), role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  return { token, user: toPublicUser(user) };
}

export function toPublicUser(user) {
  const { passwordHash: _omit, ...rest } = user;
  return rest;
}
