import { api } from './api.js';

export const fetchCategories = (params = {}) => api.get('/categories', { params }).then((r) => r.data);
export const createCategory = (body) => api.post('/categories', body).then((r) => r.data);

export const fetchProducts = (params = {}) => api.get('/products', { params }).then((r) => r.data);
export const createProduct = (body) => api.post('/products', body).then((r) => r.data);
export const updateProduct = (id, body) => api.put(`/products/${id}`, body).then((r) => r.data);
export const setProductAvailability = (id, available) =>
  api.patch(`/products/${id}/availability`, { available }).then((r) => r.data);
export const deactivateProduct = (id) => api.delete(`/products/${id}`).then((r) => r.data);

export const fetchSettings = () => api.get('/settings').then((r) => r.data);
