/** "Nuevo pedido número 105. 2 Hamburguesa clásica y 1 Gaseosa. Para domicilio." */
export function buildAnnouncement(order) {
  const items = order.items.map((i) => `${i.quantity} ${i.productName}`);
  const list = items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items.at(-1)}` : items[0];

  const extras = [];
  if (order.type === 'DOMICILIO') extras.push('Para domicilio.');
  else if (order.type === 'PARA_LLEVAR') extras.push('Para llevar.');
  if (order.notes || order.items.some((i) => i.notes)) extras.push('Tiene instrucciones especiales.');

  return `Nuevo pedido número ${order.orderNumber}. ${list}. ${extras.join(' ')}`.trim();
}
