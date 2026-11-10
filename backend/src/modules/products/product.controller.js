import * as service from './product.service.js';

// Solo el administrador puede ver productos desactivados.
const canSeeInactive = (req) => req.valid.query?.includeInactive && req.user?.role === 'ADMIN';

export async function list(req, res) {
  res.json(await service.listProducts({ ...req.valid.query, includeInactive: canSeeInactive(req) }));
}

export async function getById(req, res) {
  res.json(await service.getProduct(req.valid.params.id, { includeInactive: req.user?.role === 'ADMIN' }));
}

export async function create(req, res) {
  res.status(201).json(await service.createProduct(req.valid.body));
}

export async function update(req, res) {
  res.json(await service.updateProduct(req.valid.params.id, req.valid.body));
}

export async function setAvailability(req, res) {
  res.json(await service.setAvailability(req.valid.params.id, req.valid.body.available));
}

export async function remove(req, res) {
  res.json(await service.deactivateProduct(req.valid.params.id));
}
