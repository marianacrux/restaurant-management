import * as service from './order.service.js';

export async function create(req, res) {
  res.status(201).json(await service.createOrder(req.valid.body, { userId: req.user.id }));
}

export async function list(req, res) {
  res.json(await service.listOrders(req.valid.query));
}

export async function getById(req, res) {
  res.json(await service.getOrder(req.valid.params.id));
}

export async function history(req, res) {
  res.json(await service.getOrderHistory(req.valid.params.id));
}

export async function changeStatus(req, res) {
  res.json(await service.changeOrderStatus(req.valid.params.id, req.valid.body, req.user));
}

export async function addItems(req, res) {
  res.json(await service.addItems(req.valid.params.id, req.valid.body, req.user));
}

export async function update(req, res) {
  res.json(await service.updateOrder(req.valid.params.id, req.valid.body, req.user));
}
