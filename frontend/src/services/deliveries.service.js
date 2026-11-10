import { api } from './api.js';

// Domiciliarios
export const fetchDeliveryPersons = (params = {}) => api.get('/delivery-persons', { params }).then((r) => r.data);
export const createDeliveryPerson = (body) => api.post('/delivery-persons', body).then((r) => r.data);
export const updateDeliveryPerson = (id, body) => api.put(`/delivery-persons/${id}`, body).then((r) => r.data);
export const setDeliveryPersonAvailability = (id, availability) =>
  api.patch(`/delivery-persons/${id}/availability`, { availability }).then((r) => r.data);

// Entregas
export const fetchDeliveries = (params = {}) => api.get('/deliveries', { params }).then((r) => r.data);
export const assignDelivery = (orderId, deliveryPersonId) =>
  api.post('/deliveries/assign', { orderId, deliveryPersonId }).then((r) => r.data);
export const completeDelivery = (id) => api.patch(`/deliveries/${id}/status`, { status: 'ENTREGADO' }).then((r) => r.data);
