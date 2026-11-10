import * as authService from './auth.service.js';

export async function login(req, res) {
  res.json(await authService.login(req.valid.body));
}

export function me(req, res) {
  res.json({ user: req.user });
}
