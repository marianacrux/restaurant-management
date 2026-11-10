import { api } from './api.js';

export const fetchSummary = (date) => api.get('/dashboard/summary', { params: { date } }).then((r) => r.data);
export const fetchSalesByDay = (params) => api.get('/dashboard/sales', { params }).then((r) => r.data);
