// Formatos para Colombia. El backend envía el dinero como texto ("47000").

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export const formatMoney = (value) => moneyFormatter.format(Number(value ?? 0));

const TZ = 'America/Bogota';

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('es-CO', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' });

export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString('es-CO', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

/** Minutos transcurridos desde una fecha ISO. */
export const minutesSince = (iso, now = Date.now()) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));

/** 'YYYY-MM-DD' de hoy en Bogotá. */
export const todayLocal = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);

/** "2026-11-09" -> "lun 9" */
export const formatShortDay = (day) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('es-CO', { timeZone: 'UTC', weekday: 'short', day: 'numeric' });

/** Saldo y total pagado de un pedido a partir de sus pagos vigentes (solo para mostrar). */
export function paymentBalance(order) {
  const paid = (order.payments ?? []).filter((p) => p.status === 'PAGADO').reduce((s, p) => s + Number(p.amount), 0);
  return { paid, balance: Math.max(0, Number(order.total) - paid) };
}

/** Resume los ítems: "2 Hamburguesa clásica, 1 Gaseosa 400 ml". */
export const summarizeItems = (items = []) => items.map((i) => `${i.quantity} ${i.productName}`).join(', ');
