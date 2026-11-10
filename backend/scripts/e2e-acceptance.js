// PRUEBA DE ACEPTACIÓN DE PUNTA A PUNTA (contra la API real y PostgreSQL).
//
// Ejecuta el escenario de 20 pasos del demo, las verificaciones obligatorias y
// la matriz de permisos por rol. Crea datos reales (un producto y varios pedidos),
// por eso conviene correrla y después `npm run db:demo` para dejar la base limpia.
//
// Uso (con el backend encendido), desde backend/:
//   npm run test:e2e
import 'dotenv/config';

const API = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4000}/api`;
const PASSWORD = process.env.SEED_USER_PASSWORD;
const RUN = Date.now().toString(36).slice(-4).toUpperCase(); // sufijo único por ejecución

let passed = 0;
let failed = 0;
const failures = [];

function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  ❌ ${label}${detail ? ` → ${detail}` : ''}`);
  }
}

const section = (title) => console.log(`\n${title}`);

async function call(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* respuesta sin cuerpo */
  }
  return { status: res.status, json };
}

async function login(email) {
  const { status, json } = await call('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  if (status !== 200) throw new Error(`No se pudo iniciar sesión como ${email} (HTTP ${status})`);
  return json.token;
}

const money = (v) => Number(v);

async function main() {
  if (!PASSWORD) throw new Error('Defina SEED_USER_PASSWORD en backend/.env');
  const health = await call('/health');
  if (health.status !== 200) throw new Error(`La API no responde en ${API} (¿está encendido el backend?)`);

  console.log(`Prueba de aceptación contra ${API} · ejecución ${RUN}`);

  // ------------------------------------------------------------------ 1-2
  section('1-2. El administrador inicia sesión y registra un producto');
  const admin = await login('admin@restaurante.test');
  const cashier = await login('cajero@restaurante.test');
  const kitchen = await login('cocina@restaurante.test');
  const courierToken = await login('domiciliario@restaurante.test');
  check('Inicio de sesión de los 4 roles', Boolean(admin && cashier && kitchen && courierToken));

  const categories = (await call('/categories')).json;
  const mains = categories.find((c) => c.name === 'Platos fuertes') ?? categories[0];
  const productName = `Mazorcada especial ${RUN}`;
  const created = await call('/products', {
    token: admin,
    method: 'POST',
    body: { name: productName, description: 'Prueba automática', price: 21000, categoryId: mains.id, isDailyMenu: true },
  });
  check('Producto creado con su precio', created.status === 201 && money(created.json.price) === 21000, JSON.stringify(created.json));
  const product = created.json;
  const soda = (await call('/products?search=Gaseosa')).json[0];

  // ------------------------------------------------------------------ 3-9
  section('3-9. Pedido por el simulador de WhatsApp');
  const start = await call('/whatsapp-simulator/session', { token: cashier, method: 'POST', body: {} });
  const menu = start.json.replies.join('\n');
  const numberOf = (name) => Number(menu.match(new RegExp(`(\\d+)\\. ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} —`))?.[1]);
  const productN = numberOf(productName);
  const sodaN = numberOf(soda.name);
  check('El bot muestra el menú con el producto nuevo', Number.isInteger(productN), 'no aparece en el menú');

  const say = async (text) => (await call('/whatsapp-simulator/message', { token: cashier, method: 'POST', body: { sessionId: start.json.sessionId, text } })).json;
  await say(`${productN} x2 sin queso`);
  await say(`${sodaN}`);
  const typeStep = await say('listo');
  check('El bot pide el tipo de entrega', typeStep.step === 'TIPO');
  await say('1');
  await say('Cliente Prueba');
  await say('3101112233');
  const payStep = await say('Calle 1 # 2-3, barrio Centro, prueba');
  check('El bot solicita datos y dirección', payStep.step === 'PAGO');
  const summary = await say('1'); // efectivo al recibir
  const expected = 2 * 21000 + money(soda.price) + 5000;
  const summaryText = summary.replies.join('\n');
  check(
    'Resumen con subtotal, domicilio y total',
    summary.step === 'CONFIRMAR' && summaryText.includes('Domicilio: $5.000') && summaryText.includes(`Total: $${expected.toLocaleString('es-CO')}`),
    summaryText.split('\n').filter((l) => l.includes('Total')).join(' '),
  );
  const confirmed = await say('SI');
  check('El cliente confirma y recibe número de pedido', confirmed.step === 'FINALIZADO' && Boolean(confirmed.orderId));
  const orderId = confirmed.orderId;

  const order = (await call(`/orders/${orderId}`, { token: admin })).json;
  check('Pedido guardado en PostgreSQL con canal WHATSAPP', order.source === 'WHATSAPP' && order.type === 'DOMICILIO');
  check('Totales calculados por el backend', money(order.subtotal) === expected - 5000 && money(order.deliveryFee) === 5000 && money(order.total) === expected);
  check('Copia histórica de nombre y precio en los ítems', order.items.some((i) => i.productName === productName && money(i.unitPrice) === 21000));

  // ---------------------------------------------------------------- 10-13
  section('10-13. Panel administrativo y cocina');
  const adminList = (await call('/orders?source=WHATSAPP&pageSize=50', { token: admin })).json;
  check('El pedido aparece en el panel administrativo', adminList.data.some((o) => o.id === orderId));
  const kitchenFeed = (await call('/orders?status=CONFIRMADO,EN_PREPARACION,LISTO&sort=asc&pageSize=100', { token: kitchen })).json;
  const inKitchen = kitchenFeed.data.find((o) => o.id === orderId);
  check('La cocina recibe el pedido (CONFIRMADO, con acción disponible)', inKitchen?.status === 'CONFIRMADO' && inKitchen.availableStatuses.includes('EN_PREPARACION'));
  const prep = await call(`/orders/${orderId}/status`, { token: kitchen, method: 'PATCH', body: { status: 'EN_PREPARACION' } });
  check('Cocina lo marca EN_PREPARACION', prep.json?.status === 'EN_PREPARACION');
  const ready = await call(`/orders/${orderId}/status`, { token: kitchen, method: 'PATCH', body: { status: 'LISTO' } });
  check('El pedido pasa a LISTO', ready.json?.status === 'LISTO');

  // ---------------------------------------------------------------- 14-17
  section('14-17. Domicilio');
  const couriers = (await call('/delivery-persons', { token: admin })).json;
  const diego = couriers.find((c) => c.user?.email === 'domiciliario@restaurante.test');
  if (diego.availability !== 'DISPONIBLE') {
    await call(`/delivery-persons/${diego.id}/availability`, { token: admin, method: 'PATCH', body: { availability: 'DISPONIBLE' } });
  }
  const assigned = await call('/deliveries/assign', { token: admin, method: 'POST', body: { orderId, deliveryPersonId: diego.id } });
  check('El administrador asigna un domiciliario disponible', assigned.status === 201, JSON.stringify(assigned.json));
  check('El pedido pasa a EN_CAMINO', (await call(`/orders/${orderId}`, { token: admin })).json.status === 'EN_CAMINO');
  const mine = (await call('/deliveries', { token: courierToken })).json;
  check('El domiciliario ve la entrega asignada', mine.some((d) => d.order.id === orderId && d.status === 'EN_CAMINO'));
  const done = await call(`/deliveries/${assigned.json.id}/status`, { token: courierToken, method: 'PATCH', body: { status: 'ENTREGADO' } });
  check('El domiciliario confirma la entrega', done.json?.status === 'ENTREGADO');
  const delivered = (await call(`/orders/${orderId}`, { token: admin })).json;
  check('El pedido pasa a ENTREGADO', delivered.status === 'ENTREGADO');
  const freed = (await call('/delivery-persons', { token: admin })).json.find((c) => c.id === diego.id);
  check('El domiciliario vuelve a estar DISPONIBLE', freed.availability === 'DISPONIBLE');

  // ---------------------------------------------------------------- 18-19
  section('18-19. Pago y dashboard');
  const before = (await call('/dashboard/summary', { token: admin })).json;
  check('Antes de pagar: pago PENDIENTE aunque el cliente eligió método', delivered.paymentStatus === 'PENDIENTE' && delivered.paymentMethod === 'CONTRAENTREGA_EFECTIVO');
  const pay = await call('/payments', { token: cashier, method: 'POST', body: { orderId, method: 'CONTRAENTREGA_EFECTIVO', amount: expected } });
  check('El cajero registra el pago', pay.status === 201);
  check('El pedido queda PAGADO', (await call(`/orders/${orderId}`, { token: admin })).json.paymentStatus === 'PAGADO');
  const after = (await call('/dashboard/summary', { token: admin })).json;
  const method = (s) => money(s.byPaymentMethod.find((m) => m.method === 'CONTRAENTREGA_EFECTIVO').total);
  check('El dashboard refleja el dinero recibido', money(after.sales.collected) - money(before.sales.collected) === expected);
  check('El dashboard refleja el método de pago', method(after) - method(before) === expected);
  const waBefore = before.bySource.find((s) => s.source === 'WHATSAPP');
  const waAfter = after.bySource.find((s) => s.source === 'WHATSAPP');
  check('El dashboard cuenta la venta en el canal WhatsApp', waAfter.orders >= 1 && money(waAfter.total) >= money(waBefore.total));

  // ------------------------------------------------------------------- 20
  section('20. Pantallas digitales');
  const config = (await call('/screens/1/config', { token: admin })).json;
  const items = [
    ...config.contents.map((c) => ({ contentType: c.contentType, productId: c.productId, promotionId: c.promotionId, title: c.title, description: c.description, imageUrl: c.imageUrl, active: c.active })),
    { contentType: 'PRODUCTO', productId: product.id },
  ];
  const saved = await call('/screens/1/content', { token: admin, method: 'PUT', body: { items } });
  check('El administrador configura la pantalla 1', saved.status === 200);
  const display = (await call('/screens/1/content')).json;
  check('La pantalla pública muestra el producto con su precio', display.items.some((i) => i.title === productName && money(i.price) === 21000));
  for (const n of [2, 3, 4]) {
    const s = await call(`/screens/${n}/content`);
    check(`Pantalla ${n} responde sin iniciar sesión`, s.status === 200 && Array.isArray(s.json.items));
  }

  // --------------------------------------------------- verificaciones extra
  section('Verificaciones obligatorias');
  await call(`/products/${product.id}/availability`, { token: cashier, method: 'PATCH', body: { available: false } });
  const soldOut = await call('/orders', { token: cashier, method: 'POST', body: { source: 'VITRINA', items: [{ productId: product.id, quantity: 1 }] } });
  check('Un producto agotado no se puede agregar a un pedido', soldOut.status === 409);
  const menu2 = (await call('/whatsapp-simulator/session', { token: cashier, method: 'POST', body: {} })).json.replies.join('\n');
  check('El bot no muestra productos agotados', !menu2.includes(productName));
  const onScreen = (await call('/screens/1/content')).json.items.find((i) => i.title === productName);
  check('La pantalla lo muestra como agotado', onScreen && onScreen.available === false);
  await call(`/products/${product.id}/availability`, { token: cashier, method: 'PATCH', body: { available: true } });

  // Domiciliario ocupado
  const makeReady = async () => {
    const o = (await call('/orders', { token: cashier, method: 'POST', body: { source: 'DOMICILIO', customer: { name: 'Prueba Ocupado', phone: '3104445566' }, deliveryAddress: 'Calle 5 # 6-7, prueba', items: [{ productId: soda.id, quantity: 1 }] } })).json;
    await call(`/orders/${o.id}/status`, { token: kitchen, method: 'PATCH', body: { status: 'EN_PREPARACION' } });
    await call(`/orders/${o.id}/status`, { token: kitchen, method: 'PATCH', body: { status: 'LISTO' } });
    return o;
  };
  const o1 = await makeReady();
  const o2 = await makeReady();
  const first = await call('/deliveries/assign', { token: cashier, method: 'POST', body: { orderId: o1.id, deliveryPersonId: diego.id } });
  const second = await call('/deliveries/assign', { token: cashier, method: 'POST', body: { orderId: o2.id, deliveryPersonId: diego.id } });
  check('Un domiciliario ocupado no recibe otra asignación', first.status === 201 && second.status === 409, second.json?.error);
  await call(`/orders/${o1.id}/status`, { token: admin, method: 'PATCH', body: { status: 'CANCELADO', cancelReason: 'Prueba automática' } });
  await call(`/orders/${o2.id}/status`, { token: admin, method: 'PATCH', body: { status: 'CANCELADO', cancelReason: 'Prueba automática' } });
  const freedAgain = (await call('/delivery-persons', { token: admin })).json.find((c) => c.id === diego.id);
  check('Cancelar un pedido en camino libera al domiciliario', freedAgain.availability === 'DISPONIBLE');

  // Cancelado no cuenta como venta
  const s1 = (await call('/dashboard/summary', { token: admin })).json;
  const toCancel = (await call('/orders', { token: cashier, method: 'POST', body: { source: 'PUNTO_DE_VENTA', items: [{ productId: soda.id, quantity: 3 }] } })).json;
  const s2 = (await call('/dashboard/summary', { token: admin })).json;
  await call(`/orders/${toCancel.id}/status`, { token: cashier, method: 'PATCH', body: { status: 'CANCELADO', cancelReason: 'Prueba automática' } });
  const s3 = (await call('/dashboard/summary', { token: admin })).json;
  check('Un pedido cancelado no se contabiliza como venta', money(s2.sales.total) - money(s1.sales.total) === money(toCancel.total) && money(s3.sales.total) === money(s1.sales.total));
  const payCancelled = await call('/payments', { token: cashier, method: 'POST', body: { orderId: toCancel.id, method: 'EFECTIVO', amount: 1000 } });
  check('No se registran pagos de pedidos cancelados', payCancelled.status === 409);

  check('El canal de origen no se confunde con el método de pago', delivered.source === 'WHATSAPP' && delivered.paymentMethod === 'CONTRAENTREGA_EFECTIVO');
  const fake = await call('/orders', { token: cashier, method: 'POST', body: { source: 'VITRINA', total: 1, items: [{ productId: soda.id, quantity: 2, unitPrice: 1 }] } });
  check('Los totales los calcula el backend (precio falso ignorado)', money(fake.json.total) === 2 * money(soda.price));
  const history = (await call(`/orders/${orderId}/history`, { token: admin })).json;
  const statuses = history.map((h) => h.newStatus).join('>');
  check('Los cambios importantes quedan en el historial', statuses === 'CONFIRMADO>EN_PREPARACION>LISTO>EN_CAMINO>ENTREGADO', statuses);
  const overpay = await call('/payments', { token: cashier, method: 'POST', body: { orderId: fake.json.id, method: 'EFECTIVO', amount: money(fake.json.total) + 1 } });
  check('No se puede cobrar más que el saldo', overpay.status === 409);

  // ------------------------------------------------------------- permisos
  section('Permisos por rol');
  const matrix = [
    ['Sin sesión no ve pedidos', null, 'GET', '/orders', 401],
    ['Cocina no crea pedidos', kitchen, 'POST', '/orders', 403],
    ['Cocina no cancela pedidos', kitchen, 'PATCH', `/orders/${fake.json.id}/status`, 403, { status: 'CANCELADO', cancelReason: 'Prueba de permisos' }],
    ['Cocina no ve el dashboard', kitchen, 'GET', '/dashboard/summary', 403],
    ['Domiciliario no ve la lista de pedidos', courierToken, 'GET', '/orders', 403],
    ['Domiciliario no registra pagos', courierToken, 'POST', '/payments', 403],
    ['Cajero no edita productos', cashier, 'PUT', `/products/${product.id}`, 403, { price: 1 }],
    ['Cajero no reembolsa pagos', cashier, 'PATCH', `/payments/${pay.json.id}`, 403, { status: 'REEMBOLSADO', notes: 'prueba' }],
    ['Cajero no edita pantallas', cashier, 'PUT', '/screens/1/content', 403, { items: [] }],
    ['Cajero no registra domiciliarios', cashier, 'POST', '/delivery-persons', 403],
  ];
  for (const [label, token, method, path, expectedStatus, body] of matrix) {
    const r = await call(path, { token, method, body: body ?? (method === 'GET' ? undefined : {}) });
    check(label, r.status === expectedStatus, `HTTP ${r.status}`);
  }

  // Limpieza mínima: el producto de prueba se retira del catálogo.
  await call(`/products/${product.id}`, { token: admin, method: 'DELETE' });
  await call('/screens/1/content', { token: admin, method: 'PUT', body: { items: items.slice(0, -1) } });
}

main()
  .catch((error) => {
    failed++;
    failures.push(error.message);
    console.error(`\n💥 ${error.message}`);
  })
  .finally(() => {
    console.log(`\nResultado: ${passed} correctas, ${failed} fallidas`);
    if (failed) {
      console.log(`Fallaron: ${failures.join(' | ')}`);
      process.exitCode = 1;
    }
  });
