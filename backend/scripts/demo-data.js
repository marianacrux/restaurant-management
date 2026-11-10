// DATOS DE DEMOSTRACIÓN para la presentación.
//
// Crea una semana de pedidos usando los MISMOS servicios de la aplicación
// (crear pedido, cocina, despacho, entrega, pago), así todos los datos son
// coherentes: totales, historial, pagos y estados de domiciliarios.
// Después solo ajusta las FECHAS de los pedidos de días anteriores para que
// el gráfico de 7 días tenga información. Todo queda marcado como demo.
//
// Uso (desde backend/):  npm run db:demo   (reinicia la BD y ejecuta este script)
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';
import { createOrder, changeOrderStatus } from '../src/modules/orders/order.service.js';
import { createOrderSchema } from '../src/modules/orders/order.validator.js';
import { assignDelivery, completeDelivery } from '../src/modules/deliveries/delivery.service.js';
import { registerPayment } from '../src/modules/payments/payment.service.js';
import { addDays, todayLocal } from '../src/utils/dates.js';

// Generador pseudoaleatorio con semilla: los mismos datos en cada ejecución.
let seed = 20261110;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (min, max) => min + Math.floor(rand() * (max - min + 1));

const CUSTOMERS = [
  ['Ana López', '3005551234'], ['Carlos Medina', '3012223344'], ['Luisa Fernanda Ortiz', '3109876543'],
  ['Jorge Ramírez', '3156667788'], ['Paula Andrea Castro', '3201112233'], ['Miguel Ángel Rojas', '3174445566'],
  ['Daniela Vargas', '3138889900'], ['Andrés Felipe Suárez', '3045556677'], ['Camila Torres', '3112224455'],
  ['Sebastián Morales', '3186663322'],
];
const ADDRESSES = [
  'Calle 10 # 20-30, barrio Centro', 'Carrera 7 # 15-20, barrio Los Mártires', 'Calle 21 # 6-30, barrio Las Granjas',
  'Carrera 5 # 12-40, barrio Altico', 'Calle 8 # 4-15, barrio Quinta Oriental', 'Avenida 26 # 3-50, barrio Cándido',
];
const NOTES = ['sin cebolla', 'término medio', 'sin hielo', 'salsa aparte', null, null, null, null];

// Mezcla de canales y formas de entrega (canal ≠ forma de entrega ≠ método de pago).
const PROFILES = [
  { source: 'PUNTO_DE_VENTA', type: 'EN_LOCAL', methods: ['EFECTIVO', 'TARJETA', 'NEQUI'] },
  { source: 'PUNTO_DE_VENTA', type: 'PARA_LLEVAR', methods: ['EFECTIVO', 'NEQUI', 'DAVIPLATA'] },
  { source: 'VITRINA', type: 'PARA_LLEVAR', methods: ['EFECTIVO', 'NEQUI'] },
  { source: 'WHATSAPP', type: 'DOMICILIO', methods: ['CONTRAENTREGA_EFECTIVO', 'NEQUI', 'DAVIPLATA', 'TRANSFERENCIA'] },
  { source: 'WHATSAPP', type: 'PARA_LLEVAR', methods: ['NEQUI', 'EFECTIVO'] },
  { source: 'DOMICILIO', type: 'DOMICILIO', methods: ['CONTRAENTREGA_EFECTIVO', 'TRANSFERENCIA'] },
];

async function main() {
  const users = Object.fromEntries((await prisma.user.findMany()).map((u) => [u.role, u]));
  const products = await prisma.product.findMany({ where: { active: true, available: true } });
  const couriers = await prisma.deliveryPerson.findMany({ where: { active: true, availability: 'DISPONIBLE' } });
  const mains = products.filter((p) => Number(p.price) >= 15000);
  const sides = products.filter((p) => Number(p.price) < 15000);

  const advance = (orderId, status, by = users.COCINA) => changeOrderStatus(orderId, { status }, by);

  async function newOrder(profile, { withPaymentMethod = true } = {}) {
    const [name, phone] = pick(CUSTOMERS);
    const needsCustomer = profile.type === 'DOMICILIO' || profile.source === 'WHATSAPP' || rand() < 0.4;
    const items = [{ productId: pick(mains).id, quantity: between(1, 2), notes: pick(NOTES) ?? undefined }];
    if (rand() < 0.8) items.push({ productId: pick(sides).id, quantity: between(1, 3) });
    const input = createOrderSchema.parse({
      source: profile.source,
      type: profile.type,
      customer: needsCustomer ? { name, phone } : undefined,
      deliveryAddress: profile.type === 'DOMICILIO' ? pick(ADDRESSES) : undefined,
      paymentMethod: withPaymentMethod ? pick(profile.methods) : undefined,
      items,
    });
    // Los pedidos de WhatsApp los crea el bot (sin usuario); el resto, la caja.
    return createOrder(input, { userId: profile.source === 'WHATSAPP' ? null : users.CAJERO.id });
  }

  /** Lleva un pedido hasta ENTREGADO y (casi siempre) pagado. */
  async function complete(order, { pay = true } = {}) {
    await advance(order.id, 'EN_PREPARACION');
    await advance(order.id, 'LISTO');
    if (order.type === 'DOMICILIO') {
      const courier = pick(couriers);
      const delivery = await assignDelivery({ orderId: order.id, deliveryPersonId: courier.id }, users.CAJERO);
      await completeDelivery(delivery.id, users.ADMIN);
    } else {
      await advance(order.id, 'ENTREGADO', users.CAJERO);
    }
    if (pay) {
      const method = order.paymentMethod ?? 'EFECTIVO';
      await registerPayment(
        { orderId: order.id, method, amount: Number(order.total), reference: ['NEQUI', 'DAVIPLATA', 'TRANSFERENCIA', 'TARJETA'].includes(method) ? `DEMO-${order.orderNumber}` : null },
        users.CAJERO,
      );
    }
  }

  /** Mueve todas las fechas de un pedido (y sus registros) a `date`. */
  async function backdate(orderId, date) {
    const shift = (minutes) => new Date(date.getTime() + minutes * 60_000);
    const history = await prisma.orderStatusHistory.findMany({ where: { orderId }, orderBy: { id: 'asc' } });
    await prisma.$transaction([
      prisma.order.update({ where: { id: orderId }, data: { createdAt: date, updatedAt: shift(45) } }),
      ...history.map((h, i) => prisma.orderStatusHistory.update({ where: { id: h.id }, data: { createdAt: shift(i * 9) } })),
      prisma.payment.updateMany({ where: { orderId }, data: { createdAt: shift(50) } }),
      prisma.delivery.updateMany({ where: { orderId }, data: { assignedAt: shift(25), pickedUpAt: shift(25), deliveredAt: shift(45) } }),
    ]);
  }

  // ------------------------------------------------ 6 días anteriores
  let total = 0;
  const today = todayLocal();
  for (let back = 6; back >= 1; back--) {
    const day = addDays(today, -back);
    const count = between(6, 11);
    for (let i = 0; i < count; i++) {
      const order = await newOrder(pick(PROFILES));
      if (rand() < 0.07) {
        await changeOrderStatus(order.id, { status: 'CANCELADO', cancelReason: 'Cliente desistió (demo)' }, users.CAJERO);
      } else {
        await complete(order);
      }
      const hour = String(between(11, 21)).padStart(2, '0');
      const minute = String(between(0, 59)).padStart(2, '0');
      await backdate(order.id, new Date(`${day}T${hour}:${minute}:00-05:00`));
      total++;
    }
  }

  // ------------------------------------------------ hoy (operación en curso)
  // Entregados y pagados
  for (let i = 0; i < 5; i++) await complete(await newOrder(pick(PROFILES)));
  // Entregado pero pendiente de pago (aparece en "Pendientes de cobro")
  await complete(await newOrder(PROFILES[0]), { pay: false });
  // Cancelado (no suma como venta)
  const cancelled = await newOrder(PROFILES[1]);
  await changeOrderStatus(cancelled.id, { status: 'CANCELADO', cancelReason: 'Cliente se retiró sin esperar' }, users.CAJERO);
  // En camino
  const onTheWay = await newOrder(PROFILES[3]);
  await advance(onTheWay.id, 'EN_PREPARACION');
  await advance(onTheWay.id, 'LISTO');
  await assignDelivery({ orderId: onTheWay.id, deliveryPersonId: couriers.find((c) => !c.userId).id }, users.CAJERO);
  // Listo para despachar (para mostrar la asignación en vivo)
  const readyDelivery = await newOrder(PROFILES[5]);
  await advance(readyDelivery.id, 'EN_PREPARACION');
  await advance(readyDelivery.id, 'LISTO');
  // En cocina
  const cooking = await newOrder(PROFILES[1]);
  await advance(cooking.id, 'EN_PREPARACION');
  await newOrder(PROFILES[0]); // CONFIRMADO, esperando cocina
  total += 11;

  console.log(`✔ ${total} pedidos de demostración (7 días)`);
  console.log(`  Hoy: listos para despachar #${readyDelivery.orderNumber}, en camino #${onTheWay.orderNumber}, en cocina #${cooking.orderNumber}`);
}

try {
  await main();
} catch (error) {
  console.error('❌ Error creando datos de demostración:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
