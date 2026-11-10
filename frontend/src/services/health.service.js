import { api } from './api.js';

export async function fetchHealth() {
  // validateStatus: 503 también trae información útil (BD desconectada).
  const { data } = await api.get('/health', { validateStatus: (s) => s === 200 || s === 503 });
  return data;
}
