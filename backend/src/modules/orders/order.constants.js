// Reglas de negocio del ciclo de vida de un pedido (máquina de estados).

/** Desde cada estado, a qué estados se puede pasar. */
export const STATUS_TRANSITIONS = Object.freeze({
  PENDIENTE: ['CONFIRMADO', 'CANCELADO'],
  CONFIRMADO: ['EN_PREPARACION', 'CANCELADO'],
  EN_PREPARACION: ['LISTO', 'CANCELADO'],
  LISTO: ['EN_CAMINO', 'ENTREGADO', 'CANCELADO'],
  EN_CAMINO: ['ENTREGADO', 'CANCELADO'],
  ENTREGADO: [],
  CANCELADO: [],
});

/** A qué estados puede llevar cada rol un pedido mediante PATCH /orders/:id/status. */
export const ROLE_ALLOWED_TARGETS = Object.freeze({
  ADMIN: ['CONFIRMADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'CANCELADO'],
  CAJERO: ['CONFIRMADO', 'ENTREGADO', 'CANCELADO'],
  COCINA: ['EN_PREPARACION', 'LISTO'],
  DOMICILIARIO: [], // usa el módulo de entregas (Día 4)
});

/**
 * En pedidos a domicilio, EN_CAMINO y ENTREGADO solo se alcanzan mediante el
 * módulo de entregas (asignación de domiciliario / confirmación de entrega),
 * para que el pedido y la entrega nunca queden desincronizados.
 */
export const DELIVERY_ONLY_STATUSES = Object.freeze(['EN_CAMINO', 'ENTREGADO']);

/** Estados en los que aún se pueden agregar productos (cocina no ha empezado). */
export const EDITABLE_ITEMS_STATUSES = Object.freeze(['PENDIENTE', 'CONFIRMADO']);

/** Estados finales: el pedido ya no admite cambios. */
export const CLOSED_STATUSES = Object.freeze(['ENTREGADO', 'CANCELADO']);
