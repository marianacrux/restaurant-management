import { api } from './api.js';

// Público (televisores)
export const fetchScreenDisplay = (number) => api.get(`/screens/${number}/content`).then((r) => r.data);

// Administración
export const fetchScreens = () => api.get('/screens').then((r) => r.data);
export const fetchScreenConfig = (number) => api.get(`/screens/${number}/config`).then((r) => r.data);
export const saveScreenContent = (number, body) => api.put(`/screens/${number}/content`, body).then((r) => r.data);
export const fetchPromotions = () => api.get('/promotions').then((r) => r.data);
