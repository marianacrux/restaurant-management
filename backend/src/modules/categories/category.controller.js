import * as service from './category.service.js';

export async function list(req, res) {
  const includeInactive = req.valid.query.includeInactive && req.user?.role === 'ADMIN';
  res.json(await service.listCategories({ includeInactive }));
}

export async function create(req, res) {
  res.status(201).json(await service.createCategory(req.valid.body));
}

export async function update(req, res) {
  res.json(await service.updateCategory(req.valid.params.id, req.valid.body));
}
