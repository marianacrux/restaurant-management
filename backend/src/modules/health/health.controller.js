import { getHealthStatus } from './health.service.js';

export async function healthCheck(_req, res) {
  const health = await getHealthStatus();
  res.status(health.database.connected ? 200 : 503).json(health);
}
