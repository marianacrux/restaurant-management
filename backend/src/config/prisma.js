// Instancia única de PrismaClient para toda la aplicación.
// Crear varias instancias abre pools de conexiones duplicados.
import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

export const prisma = new PrismaClient({
  log: env.isProduction ? ['error'] : ['warn', 'error'],
});
