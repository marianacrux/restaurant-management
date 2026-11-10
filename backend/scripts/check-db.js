// Uso: npm run db:check  (desde la carpeta backend/)
// Verifica la conexión a PostgreSQL usando DATABASE_URL del archivo .env.
import { prisma } from '../src/config/prisma.js';

try {
  const [row] = await prisma.$queryRaw`
    SELECT current_database() AS database, current_user AS "user", version() AS version`;
  console.log('✅ Conexión a PostgreSQL exitosa');
  console.log(`   Base de datos: ${row.database}`);
  console.log(`   Usuario:       ${row.user}`);
  console.log(`   Servidor:      ${row.version.split(',')[0]}`);
} catch (error) {
  console.error('❌ No se pudo conectar a PostgreSQL');
  console.error(`   ${error.message.split('\n').filter(Boolean).at(-1)}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
