import { prisma } from '../../config/prisma.js';

// Comprueba que la API puede hablar con PostgreSQL.
export async function getHealthStatus() {
  const startedAt = Date.now();
  try {
    const [row] = await prisma.$queryRaw`SELECT current_database() AS database, version() AS version`;
    return {
      status: 'ok',
      database: {
        connected: true,
        name: row.database,
        version: row.version.split(' ').slice(0, 2).join(' '),
        latencyMs: Date.now() - startedAt,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'degraded',
      database: { connected: false, error: error.message.split('\n').at(-1) },
      timestamp: new Date().toISOString(),
    };
  }
}
