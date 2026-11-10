// MOTOR DE CONVERSACIÓN DEL BOT (independiente del canal).
//
// Recibe el estado de la sesión y el texto del cliente, y devuelve el nuevo
// estado y las respuestas. No sabe si el mensaje vino del simulador o de la
// API oficial de WhatsApp: eso lo resuelve bot.service.js. Tampoco accede a la
// base de datos directamente: usa las funciones de `ctx` (catálogo, costo de
// domicilio, creación de pedidos), lo que lo hace fácil de probar y de reutilizar.
//
// Pasos: MENU -> TIPO -> NOMBRE -> TELEFONO -> DIRECCION -> PAGO -> CONFIRMAR -> FINALIZADO

const STEPS = Object.freeze({
  MENU: 'MENU',
  TIPO: 'TIPO',
  NOMBRE: 'NOMBRE',
  TELEFONO: 'TELEFONO',
  DIRECCION: 'DIRECCION',
  PAGO: 'PAGO',
  CONFIRMAR: 'CONFIRMAR',
  FINALIZADO: 'FINALIZADO',
});
export { STEPS };

const PAYMENT_OPTIONS = {
  DOMICILIO: [
    ['CONTRAENTREGA_EFECTIVO', 'Efectivo al recibir'],
    ['NEQUI', 'Nequi'],
    ['DAVIPLATA', 'Daviplata'],
    ['TRANSFERENCIA', 'Transferencia bancaria'],
  ],
  PARA_LLEVAR: [
    ['EFECTIVO', 'Efectivo en el restaurante'],
    ['NEQUI', 'Nequi'],
    ['DAVIPLATA', 'Daviplata'],
    ['TARJETA', 'Tarjeta en el restaurante'],
  ],
};

const fmt = (value) => `$${Number(value).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
const normalize = (text) =>
  text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const YES = ['si', 's', 'confirmar', 'confirmo', 'ok', 'dale', 'listo'];
const NO = ['no', 'n'];

// ------------------------------------------------------------- mensajes

function menuText(menu, restaurantName) {
  const lines = [`🍽 *Menú de hoy · ${restaurantName}*`];
  let category = null;
  for (const item of menu) {
    if (item.category !== category) {
      category = item.category;
      lines.push('', `*${category}*`);
    }
    lines.push(`${item.n}. ${item.name} — ${fmt(item.price)}${item.daily ? ' ⭐' : ''}`);
  }
  lines.push('', '⭐ = menú del día');
  return lines.join('\n');
}

const HOW_TO_ORDER =
  '✍️ Escribe el *número* del producto y la cantidad. Ejemplos:\n' +
  '• *5* → 1 unidad\n' +
  '• *5 x2* → 2 unidades\n' +
  '• *5 x2 sin cebolla* → con instrucciones\n\n' +
  'Escribe *LISTO* cuando termines, *VER* para ver tu pedido o *CANCELAR* para empezar de nuevo.';

function cartText(cart) {
  if (!cart.length) return 'Tu pedido está vacío.';
  const lines = cart.map((l, i) => `${i + 1}) ${l.quantity} × ${l.name}${l.notes ? ` _(${l.notes})_` : ''} — ${fmt(l.price * l.quantity)}`);
  const subtotal = cart.reduce((s, l) => s + l.price * l.quantity, 0);
  return ['🧾 *Tu pedido*', ...lines, `Subtotal: *${fmt(subtotal)}*`, '', 'Para quitar un producto escribe *QUITAR* y su número (ej.: QUITAR 1).'].join('\n');
}

function paymentQuestion(type) {
  const options = PAYMENT_OPTIONS[type];
  return ['💳 ¿Cómo vas a pagar?', ...options.map(([, label], i) => `${i + 1}. ${label}`)].join('\n');
}

// ------------------------------------------------------------- arranque

/** Primer mensaje de una conversación nueva. */
export async function startConversation(ctx, { phone } = {}) {
  const menu = await ctx.getMenu();
  const data = { menu, cart: [], phone: phone ?? null };
  if (!menu.length) {
    return { step: STEPS.FINALIZADO, data, replies: ['😔 Lo sentimos, en este momento no tenemos productos disponibles.'] };
  }
  return {
    step: STEPS.MENU,
    data,
    replies: [`👋 ¡Hola! Bienvenido a *${ctx.restaurantName}*. Soy el asistente de pedidos.`, menuText(menu, ctx.restaurantName), HOW_TO_ORDER],
  };
}

// ------------------------------------------------------------- mensajes

/**
 * Procesa un mensaje del cliente.
 * @returns {{ step: string, data: object, replies: string[], orderId?: number }}
 */
export async function handleMessage(session, rawText, ctx) {
  const text = rawText.trim();
  const cmd = normalize(text);
  const data = structuredClone(session.data ?? {});
  data.cart ??= [];

  // Reinicio en cualquier paso (en MENU, "hola"/"nuevo" no borran el carrito por accidente).
  if (cmd === 'cancelar' || (['reiniciar', 'nuevo', 'hola'].includes(cmd) && session.step !== STEPS.MENU)) {
    return startConversation(ctx, { phone: data.phone });
  }

  switch (session.step) {
    case STEPS.MENU:
      return handleMenu(session, text, cmd, data, ctx);
    case STEPS.TIPO:
      return handleType(text, cmd, data);
    case STEPS.NOMBRE:
      return handleName(text, data);
    case STEPS.TELEFONO:
      return handlePhone(text, data);
    case STEPS.DIRECCION:
      return handleAddress(text, data);
    case STEPS.PAGO:
      return handlePayment(cmd, data, ctx);
    case STEPS.CONFIRMAR:
      return handleConfirm(cmd, data, ctx);
    case STEPS.FINALIZADO:
      return handleFinished(data, ctx);
    default:
      return startConversation(ctx, { phone: data.phone });
  }
}

async function handleMenu(session, text, cmd, data, ctx) {
  const reply = (replies) => ({ step: STEPS.MENU, data, replies });

  if (cmd === 'menu') return reply([menuText(data.menu, ctx.restaurantName), HOW_TO_ORDER]);
  if (cmd === 'ver' || cmd === 'carrito' || cmd === 'pedido') return reply([cartText(data.cart)]);
  if (cmd === 'ayuda') return reply([HOW_TO_ORDER]);

  const remove = cmd.match(/^quitar\s+(\d+)$/);
  if (remove) {
    const index = Number(remove[1]) - 1;
    if (!data.cart[index]) return reply([`No encuentro la línea ${remove[1]} en tu pedido.`, cartText(data.cart)]);
    const [removed] = data.cart.splice(index, 1);
    return reply([`🗑 Quité ${removed.quantity} × ${removed.name}.`, cartText(data.cart)]);
  }

  if (['listo', 'ya', 'terminar', 'eso es todo', 'nada mas'].includes(cmd)) {
    if (!data.cart.length) return reply(['Tu pedido está vacío. Escribe el número de un producto para agregarlo.']);
    return {
      step: STEPS.TIPO,
      data,
      replies: [cartText(data.cart), '🚚 ¿Cómo quieres recibir tu pedido?\n1. *Domicilio*\n2. *Recoger* en el restaurante'],
    };
  }

  // "5", "5 x2", "5x2", "5 2", "5 x2 sin cebolla"
  const match = text.match(/^(\d{1,3})(?:\s*[x×*]\s*(\d{1,2})|\s+(\d{1,2})(?=\s|$))?\s*(.*)$/i);
  if (!match) {
    return reply(['🤔 No entendí. Escribe el número del producto (ej.: *5 x2*) o *LISTO* para continuar.']);
  }
  const [, numStr, qtyA, qtyB, notesRaw] = match;
  const item = data.menu.find((m) => m.n === Number(numStr));
  if (!item) return reply([`No existe el producto número ${numStr}. Escribe *MENU* para ver la lista.`]);
  const quantity = Number(qtyA ?? qtyB ?? 1);
  if (quantity < 1 || quantity > 20) return reply(['La cantidad debe estar entre 1 y 20.']);

  // Se vuelve a consultar el catálogo: el producto pudo agotarse desde que se mostró el menú.
  const fresh = await ctx.getProduct(item.productId);
  if (!fresh || !fresh.active || !fresh.available) {
    return reply([`😔 *${item.name}* se acaba de agotar. Elige otro producto.`]);
  }

  const notes = notesRaw.trim().slice(0, 200) || null;
  const existing = data.cart.find((l) => l.productId === item.productId && (l.notes ?? null) === notes);
  if (existing) existing.quantity = Math.min(20, existing.quantity + quantity);
  else data.cart.push({ productId: item.productId, name: fresh.name, price: Number(fresh.price), quantity, notes });

  const count = data.cart.reduce((s, l) => s + l.quantity, 0);
  return reply([
    `✅ Agregado: ${quantity} × *${fresh.name}*${notes ? ` _(${notes})_` : ''}.\nLlevas ${count} ${count === 1 ? 'producto' : 'productos'}. ¿Algo más? Escribe otro número o *LISTO*.`,
  ]);
}

function handleType(text, cmd, data) {
  if (['1', 'domicilio', 'a domicilio'].includes(cmd)) data.type = 'DOMICILIO';
  else if (['2', 'recoger', 'para llevar', 'llevar'].includes(cmd)) data.type = 'PARA_LLEVAR';
  else return { step: STEPS.TIPO, data, replies: ['Responde *1* para domicilio o *2* para recoger en el restaurante.'] };
  return { step: STEPS.NOMBRE, data, replies: ['👤 ¿A nombre de quién va el pedido?'] };
}

function handleName(text, data) {
  const name = text.replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 80 || /\d/.test(name)) {
    return { step: STEPS.NOMBRE, data, replies: ['Escribe tu nombre (solo letras), por ejemplo: *Ana López*.'] };
  }
  data.name = name;
  if (data.phone) return afterPhone(data, [`Gracias, ${name.split(' ')[0]}. Usaremos el número ${data.phone}.`]);
  return { step: STEPS.TELEFONO, data, replies: [`Gracias, ${name.split(' ')[0]}. 📱 ¿Cuál es tu número de celular? (10 dígitos)`] };
}

function handlePhone(text, data) {
  const phone = text.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '');
  if (!/^3\d{9}$/.test(phone)) {
    return { step: STEPS.TELEFONO, data, replies: ['Ese número no parece válido. Escribe un celular de 10 dígitos, ej.: *3001234567*.'] };
  }
  data.phone = phone;
  return afterPhone(data, []);
}

function afterPhone(data, prefix) {
  if (data.type === 'DOMICILIO') {
    return { step: STEPS.DIRECCION, data, replies: [...prefix, '📍 ¿Cuál es la dirección de entrega? Incluye barrio y punto de referencia.'] };
  }
  return { step: STEPS.PAGO, data, replies: [...prefix, paymentQuestion(data.type)] };
}

function handleAddress(text, data) {
  const address = text.replace(/\s+/g, ' ').trim();
  if (address.length < 8) {
    return { step: STEPS.DIRECCION, data, replies: ['La dirección es muy corta. Ejemplo: *Calle 10 # 20-30, barrio Centro*.'] };
  }
  data.address = address.slice(0, 250);
  return { step: STEPS.PAGO, data, replies: [paymentQuestion(data.type)] };
}

async function handlePayment(cmd, data, ctx) {
  const options = PAYMENT_OPTIONS[data.type];
  const index = Number(cmd) - 1;
  if (!Number.isInteger(index) || !options[index]) {
    return { step: STEPS.PAGO, data, replies: [`Responde con un número del 1 al ${options.length}.`, paymentQuestion(data.type)] };
  }
  data.paymentMethod = options[index][0];
  return { step: STEPS.CONFIRMAR, data, replies: [await summaryText(data, ctx)] };
}

/** Resumen con precios y domicilio consultados en el momento (no los guardados en la sesión). */
async function summaryText(data, ctx) {
  const products = await ctx.getProducts(data.cart.map((l) => l.productId));
  const priceOf = (id) => Number(products.find((p) => p.id === id)?.price ?? 0);
  const subtotal = data.cart.reduce((s, l) => s + priceOf(l.productId) * l.quantity, 0);
  const fee = data.type === 'DOMICILIO' ? Number(await ctx.getDeliveryFee()) : 0;
  const payment = PAYMENT_OPTIONS[data.type].find(([v]) => v === data.paymentMethod)[1];

  return [
    '📋 *Resumen de tu pedido*',
    ...data.cart.map((l) => `• ${l.quantity} × ${l.name}${l.notes ? ` _(${l.notes})_` : ''} — ${fmt(priceOf(l.productId) * l.quantity)}`),
    '',
    `Subtotal: ${fmt(subtotal)}`,
    data.type === 'DOMICILIO' ? `Domicilio: ${fmt(fee)}` : 'Recoges en el restaurante',
    `*Total: ${fmt(subtotal + fee)}*`,
    '',
    `👤 ${data.name} · 📱 ${data.phone}`,
    data.type === 'DOMICILIO' ? `📍 ${data.address}` : null,
    `💳 ${payment}`,
    '',
    '¿Confirmas el pedido? Responde *SI* para confirmar o *NO* para cancelar.',
  ]
    .filter((l) => l !== null)
    .join('\n');
}

async function handleConfirm(cmd, data, ctx) {
  if (NO.includes(cmd)) return startConversation(ctx, { phone: data.phone }).then((r) => ({ ...r, replies: ['❌ Pedido cancelado.', ...r.replies] }));
  if (!YES.includes(cmd)) return { step: STEPS.CONFIRMAR, data, replies: ['Responde *SI* para confirmar o *NO* para cancelar.'] };

  try {
    const order = await ctx.createOrder({
      source: 'WHATSAPP',
      type: data.type,
      customer: { name: data.name, phone: data.phone },
      items: data.cart.map((l) => ({ productId: l.productId, quantity: l.quantity, notes: l.notes ?? undefined })),
      deliveryAddress: data.type === 'DOMICILIO' ? data.address : undefined,
      paymentMethod: data.paymentMethod,
      confirm: true,
    });
    data.orderNumber = order.orderNumber;
    return {
      step: STEPS.FINALIZADO,
      data,
      orderId: order.id,
      replies: [
        `🎉 ¡Pedido confirmado!\nTu número de pedido es *#${order.orderNumber}*.\nTotal: *${fmt(order.total)}*`,
        data.type === 'DOMICILIO'
          ? '👨‍🍳 Ya está en cocina. Te avisaremos cuando salga el domiciliario.'
          : '👨‍🍳 Ya está en cocina. Te esperamos en el restaurante.',
        'Escribe *ESTADO* para consultar tu pedido o *NUEVO* para hacer otro.',
      ],
    };
  } catch (error) {
    // Un producto se agotó o retiró entre el resumen y la confirmación.
    const unavailable = (error.details ?? []).map((d) => d.productId).filter(Boolean);
    if (error.statusCode === 409 && unavailable.length) {
      data.cart = data.cart.filter((l) => !unavailable.includes(l.productId));
      return {
        step: STEPS.MENU,
        data,
        replies: [`😔 ${error.message}. Lo quité de tu pedido.`, cartText(data.cart), 'Agrega otro producto o escribe *LISTO* para continuar.'],
      };
    }
    throw error;
  }
}

async function handleFinished(data, ctx) {
  if (!data.orderNumber) return startConversation(ctx, { phone: data.phone });
  const status = await ctx.getOrderStatus(data.orderNumber);
  return {
    step: STEPS.FINALIZADO,
    data,
    replies: [`📦 Tu pedido *#${data.orderNumber}* está: *${status ?? 'sin información'}*.\nEscribe *NUEVO* para hacer otro pedido.`],
  };
}
