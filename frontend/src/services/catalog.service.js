import { api } from './api.js';

export const fetchCategories = () => api.get('/categories').then((r) => r.data);
export const fetchProducts = (params = {}) => api.get('/products', { params }).then((r) => r.data);
export const fetchSettings = () => api.get('/settings').then((r) => r.data);
