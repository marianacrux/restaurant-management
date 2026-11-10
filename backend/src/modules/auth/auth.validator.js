import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Correo inválido').trim().toLowerCase(),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});
