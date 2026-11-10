import { api } from './api.js';

/** filters: { status: ['A','B'], source, search, page, pageSize, sort } */
export function fetchOrders(filters = {}) {
  const params = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) params[key] = value.join(',');
    } else params[key] = value;
  }
  return api.get('/orders', { params }).then((r) => r.data);
}

export const fetchOrder = (id) => api.get(`/orders/${id}`).then((r) => r.data);
export const createOrder = (payload) => api.post('/orders', payload).then((r) => r.data);
export const changeOrderStatus = (id, body) => api.patch(`/orders/${id}/status`, body).then((r) => r.data);
