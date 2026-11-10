// Etiquetas legibles y tonos de color para los enums del backend.
// El "tone" se traduce a colores en components/ui/Badge.module.css.

export const ORDER_STATUS = {
  PENDIENTE: { label: 'Pendiente', tone: 'neutral' },
  CONFIRMADO: { label: 'Confirmado', tone: 'info' },
  EN_PREPARACION: { label: 'En preparación', tone: 'warning' },
  LISTO: { label: 'Listo', tone: 'success' },
  EN_CAMINO: { label: 'En camino', tone: 'accent' },
  ENTREGADO: { label: 'Entregado', tone: 'done' },
  CANCELADO: { label: 'Cancelado', tone: 'danger' },
};

/** Texto del botón que lleva un pedido a cada estado. */
export const STATUS_ACTION_LABEL = {
  CONFIRMADO: 'Confirmar pedido',
  EN_PREPARACION: 'Iniciar preparación',
  LISTO: 'Marcar listo',
  ENTREGADO: 'Marcar entregado',
  CANCELADO: 'Cancelar pedido',
};

export const ORDER_SOURCE = {
  WHATSAPP: { label: 'WhatsApp', short: 'WA' },
  VITRINA: { label: 'Vitrina', short: 'VIT' },
  PUNTO_DE_VENTA: { label: 'Punto de venta', short: 'POS' },
  DOMICILIO: { label: 'Domicilio', short: 'DOM' },
};

export const ORDER_TYPE = {
  EN_LOCAL: 'En el local',
  PARA_LLEVAR: 'Para llevar',
  DOMICILIO: 'Domicilio',
};

export const PAYMENT_METHOD = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  NEQUI: 'Nequi',
  DAVIPLATA: 'Daviplata',
  TARJETA: 'Tarjeta',
  CONTRAENTREGA_EFECTIVO: 'Contraentrega (efectivo)',
};

export const PAYMENT_STATUS = {
  PENDIENTE: { label: 'Pago pendiente', tone: 'warning' },
  PARCIAL: { label: 'Pago parcial', tone: 'info' },
  PAGADO: { label: 'Pagado', tone: 'success' },
  REEMBOLSADO: { label: 'Reembolsado', tone: 'neutral' },
};

export const ROLE_LABEL = {
  ADMIN: 'Administrador',
  CAJERO: 'Cajero',
  COCINA: 'Cocina',
  DOMICILIARIO: 'Domiciliario',
};

/** Pantalla de inicio de cada rol tras iniciar sesión. */
export const ROLE_HOME = {
  ADMIN: '/dashboard',
  CAJERO: '/pedidos',
  COCINA: '/cocina',
  DOMICILIARIO: '/entregas',
};

export const ALL_STAFF = ['ADMIN', 'CAJERO', 'COCINA', 'DOMICILIARIO'];
