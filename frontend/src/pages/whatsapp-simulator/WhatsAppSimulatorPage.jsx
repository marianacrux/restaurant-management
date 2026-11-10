import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { startChat, sendChatMessage } from '../../services/whatsapp.service.js';
import { getErrorMessage } from '../../services/api.js';
import { Alert, Button, Card, Field, PageHeader } from '../../components/ui/index.jsx';
import { formatMoney, formatTime } from '../../utils/format.js';
import WhatsAppText from './WhatsAppText.jsx';
import styles from './WhatsAppSimulatorPage.module.css';

/** Respuestas rápidas según el paso de la conversación (atajos para el demo). */
const QUICK_REPLIES = {
  MENU: ['LISTO', 'VER', 'MENU'],
  TIPO: ['1', '2'],
  PAGO: ['1', '2', '3', '4'],
  CONFIRMAR: ['SI', 'NO'],
  FINALIZADO: ['ESTADO', 'NUEVO'],
};

const STEP_LABEL = {
  MENU: 'Eligiendo productos',
  TIPO: 'Tipo de entrega',
  NOMBRE: 'Nombre del cliente',
  TELEFONO: 'Teléfono',
  DIRECCION: 'Dirección',
  PAGO: 'Método de pago',
  CONFIRMAR: 'Esperando confirmación',
  FINALIZADO: 'Pedido registrado',
};

let messageId = 0;
const botMessages = (replies) => replies.map((text) => ({ id: ++messageId, from: 'bot', text, at: new Date().toISOString() }));

export default function WhatsAppSimulatorPage() {
  const [phone, setPhone] = useState('');
  const [session, setSession] = useState(null); // { id, step, cart, orderId }
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  async function start(e) {
    e?.preventDefault();
    const digits = phone.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '');
    if (phone && !/^3\d{9}$/.test(digits)) return setError('El celular debe tener 10 dígitos y empezar por 3 (o déjelo vacío).');
    setBusy(true);
    setError('');
    try {
      const res = await startChat(digits || undefined);
      setSession({ id: res.sessionId, step: res.step, cart: [], orderId: null, phone: digits || null });
      setMessages(botMessages(res.replies));
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function send(text) {
    const value = text.trim();
    if (!value || busy || !session) return;
    setInput('');
    setMessages((m) => [...m, { id: ++messageId, from: 'client', text: value, at: new Date().toISOString() }]);
    setBusy(true);
    setError('');
    try {
      const res = await sendChatMessage(session.id, value);
      setSession((s) => ({ ...s, step: res.step, cart: res.cart, orderId: res.orderId ?? s.orderId }));
      setMessages((m) => [...m, ...botMessages(res.replies)]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  const subtotal = session?.cart.reduce((s, l) => s + l.price * l.quantity, 0) ?? 0;

  return (
    <>
      <PageHeader title="Simulador de WhatsApp" subtitle="Pruebe el bot de pedidos como si fuera un cliente" />

      <div className={styles.layout}>
        {/* ----------------------------- Teléfono ----------------------------- */}
        <section className={styles.phone} aria-label="Conversación simulada">
          <header className={styles.chatHeader}>
            <span className={styles.avatar} aria-hidden="true">R</span>
            <div>
              <div className={styles.chatName}>Restaurante · Pedidos</div>
              <div className={styles.chatStatus}>{busy ? 'escribiendo…' : 'en línea'}</div>
            </div>
          </header>

          <div className={styles.messages} role="log" aria-live="polite">
            {!session && (
              <div className={styles.placeholder}>
                Inicie una conversación para simular a un cliente que escribe al WhatsApp del restaurante.
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`${styles.bubble} ${m.from === 'bot' ? styles.bot : styles.client}`}>
                <WhatsAppText text={m.text} />
                <span className={styles.time}>{formatTime(m.at)}</span>
              </div>
            ))}
            {busy && session && <div className={`${styles.bubble} ${styles.bot} ${styles.typing}`}>•••</div>}
            <div ref={bottomRef} />
          </div>

          {session && QUICK_REPLIES[session.step] && (
            <div className={styles.quick}>
              {QUICK_REPLIES[session.step].map((q) => (
                <button key={q} type="button" className={styles.chip} onClick={() => send(q)} disabled={busy}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <form
            className={styles.composer}
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              ref={inputRef}
              className={styles.input}
              placeholder={session ? 'Escribe un mensaje' : 'Inicie una conversación →'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!session}
              maxLength={500}
              aria-label="Mensaje del cliente"
            />
            <button className={styles.send} type="submit" disabled={!session || busy || !input.trim()} aria-label="Enviar">
              ➤
            </button>
          </form>
        </section>

        {/* ---------------------------- Panel lateral ---------------------------- */}
        <div className={styles.side}>
          <Alert type="info">
            <strong>Modo simulación.</strong> No se envían mensajes reales por WhatsApp. El bot usa el catálogo real y
            registra los pedidos en el sistema central con canal WHATSAPP.
          </Alert>

          <Card title="Conversación">
            <form className={styles.startForm} onSubmit={start}>
              <Field
                label="Celular del cliente (opcional)"
                hint="Con WhatsApp real el número llega automáticamente. Si lo deja vacío, el bot lo preguntará."
                placeholder="3001234567"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Button type="submit" loading={busy && !session} variant={session ? 'secondary' : 'primary'}>
                {session ? 'Reiniciar conversación' : 'Iniciar conversación'}
              </Button>
            </form>
            {error && <Alert>{error}</Alert>}
          </Card>

          {session && (
            <Card title="Estado del bot">
              <dl className={styles.info}>
                <dt>Paso</dt>
                <dd>{STEP_LABEL[session.step] ?? session.step}</dd>
                <dt>Productos</dt>
                <dd>{session.cart.reduce((n, l) => n + l.quantity, 0)}</dd>
                <dt>Subtotal</dt>
                <dd>{formatMoney(subtotal)}</dd>
              </dl>
              {session.cart.length > 0 && (
                <ul className={styles.cart}>
                  {session.cart.map((l, i) => (
                    <li key={i}>
                      {l.quantity} × {l.name}
                      {l.notes && <em> ({l.notes})</em>}
                    </li>
                  ))}
                </ul>
              )}
              {session.orderId && (
                <div className={styles.created}>
                  ✅ Pedido registrado.{' '}
                  <Link to={`/pedidos/${session.orderId}`}>Ver detalle</Link> · <Link to="/cocina">Ir a cocina</Link>
                </div>
              )}
            </Card>
          )}

          <Card title="Cómo pedir">
            <ul className={styles.help}>
              <li><code>5</code> agrega el producto 5</li>
              <li><code>5 x2</code> agrega 2 unidades</li>
              <li><code>5 x2 sin cebolla</code> con instrucciones</li>
              <li><code>VER</code> muestra el pedido · <code>QUITAR 1</code> quita una línea</li>
              <li><code>LISTO</code> continúa · <code>CANCELAR</code> empieza de nuevo</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
