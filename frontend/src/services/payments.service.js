import { api } from './api.js';

export const fetchPayments = (params = {}) => api.get('/payments', { params }).then((r) => r.data);
export const registerPayment = (body) => api.post('/payments', body).then((r) => r.data);
export const refundPayment = (id, notes) => api.patch(`/payments/${id}`, { status: 'REEMBOLSADO', notes }).then((r) => r.data);
