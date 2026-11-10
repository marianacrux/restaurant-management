import * as service from './order.service.js';

/** Añade las acciones de estado que el usuario actual puede ejecutar. */
const withActions = (order, user) => ({ ...order, availableStatuses: service.getAvailableStatuses(order, user.role) });

export async function create(req, res) {
  res.status(201).json(withActions(await service.createOrder(req.valid.body, { userId: req.user.id }), req.user));
}

export async function list(req, res) {
  const result = await service.listOrders(req.valid.query);
  res.json({ ...result, data: result.data.map((o) => withActions(o, req.user)) });
}

export async function getById(req, res) {
  res.json(withActions(await service.getOrder(req.valid.params.id), req.user));
}

export async function history(req, res) {
  res.json(await service.getOrderHistory(req.valid.params.id));
}

export async function changeStatus(req, res) {
  res.json(withActions(await service.changeOrderStatus(req.valid.params.id, req.valid.body, req.user), req.user));
}

export async function addItems(req, res) {
  res.json(withActions(await service.addItems(req.valid.params.id, req.valid.body, req.user), req.user));
}

export async function update(req, res) {
  res.json(withActions(await service.updateOrder(req.valid.params.id, req.valid.body, req.user), req.user));
}
