import { api } from './api.js';

// Simulador: el mismo motor de conversación que usará la integración real con WhatsApp Cloud API.
export const startChat = (phone) => api.post('/whatsapp-simulator/session', phone ? { phone } : {}).then((r) => r.data);
export const sendChatMessage = (sessionId, text) => api.post('/whatsapp-simulator/message', { sessionId, text }).then((r) => r.data);
