// Punto de entrada: crea el servidor HTTP y gestiona el apagado ordenado.
import http from 'node:http';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { createApp } from './app.js';

const app = createApp();
const server = http.createServer(app); // En la etapa 2, Socket.IO se adjunta a este `server`.

server.listen(env.PORT, () => {
  console.log(`🚀 API escuchando en http://localhost:${env.PORT}/api (${env.NODE_ENV})`);
});

async function shutdown(signal) {
  console.log(`\n${signal} recibido. Cerrando servidor...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
