import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { useSpeechAnnouncer } from '../../hooks/useSpeechAnnouncer.js';
import { changeOrderStatus, fetchOrders } from '../../services/orders.service.js';
import { getErrorMessage } from '../../services/api.js';
import { ORDER_SOURCE, ORDER_TYPE } from '../../utils/constants.js';
import { formatTime, minutesSince } from '../../utils/format.js';
import { buildAnnouncement } from './announcement.js';
import styles from './KitchenPage.module.css';

const POLL_MS = 4000; // etapa 2: se reemplaza por eventos de Socket.IO
const HIGHLIGHT_MS = 20_000;
const COLUMNS = [
  { status: 'CONFIRMADO', title: 'Por preparar', action: 'EN_PREPARACION', actionLabel: 'Iniciar preparación' },
  { status: 'EN_PREPARACION', title: 'En preparación', action: 'LISTO', actionLabel: 'Marcar listo' },
  { status: 'LISTO', title: 'Listos' },
];

export default function KitchenPage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const audio = useSpeechAnnouncer();
  const { announce } = audio;
  const now = useNow(15_000);
  const [highlighted, setHighlighted] = useState({}); // id -> hasta cuándo resaltar
  const [banner, setBanner] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const seen = useRef(null);

  const load = useCallback(
    () => fetchOrders({ status: COLUMNS.map((c) => c.status), sort: 'asc', pageSize: 100 }).then((r) => r.data),
    [],
  );
  // pauseWhenHidden: false -> sigue consultando aunque la pestaña esté en segundo plano.
  const { data: orders, error, lastUpdated, reload } = useResource(load, { interval: POLL_MS, pauseWhenHidden: false });

  // Detecta pedidos nuevos. En la primera carga solo se registran (no se anuncian
  // los que ya estaban); después, cada CONFIRMADO no visto se anuncia y resalta.
  useEffect(() => {
    if (!orders) return;
    if (seen.current === null) {
      seen.current = new Set(orders.map((o) => o.id));
      return;
    }
    const fresh = orders.filter((o) => !seen.current.has(o.id) && o.status === 'CONFIRMADO');
    orders.forEach((o) => seen.current.add(o.id));
    if (!fresh.length) return;

    fresh.forEach((o) => announce(buildAnnouncement(o)));
    const until = Date.now() + HIGHLIGHT_MS;
    setHighlighted((h) => ({ ...h, ...Object.fromEntries(fresh.map((o) => [o.id, until])) }));
    setBanner(fresh.length === 1 ? `Nuevo pedido #${fresh[0].orderNumber}` : `${fresh.length} pedidos nuevos`);
  }, [orders, announce]);

  useEffect(() => {
    if (!banner) return undefined;
    const t = setTimeout(() => setBanner(null), 8000);
    return () => clearTimeout(t);
  }, [banner]);

  async function advance(order, status) {
    setBusyId(order.id);
    try {
      await changeOrderStatus(order.id, { status });
      await reload({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
      reload({ silent: true });
    } finally {
      setBusyId(null);
    }
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const byStatus = (status) => (orders ?? []).filter((o) => o.status === status);

  // Repite el último anuncio; si todavía no hubo ninguno en esta sesión,
  // lee el pedido más reciente que espera cocina (o avisa que no hay).
  const repeat = () => {
    const latest = byStatus('CONFIRMADO').at(-1) ?? byStatus('EN_PREPARACION').at(-1);
    audio.repeatLast(latest ? buildAnnouncement(latest, { isNew: false }) : 'No hay pedidos pendientes en cocina');
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Cocina</h1>
          <span className={styles.clock}>{formatTime(new Date(now).toISOString())}</span>
          <span className={`${styles.conn} ${error ? styles.connBad : ''}`}>
            {error ? 'Sin conexión · reintentando' : lastUpdated ? `En línea · ${formatTime(lastUpdated.toISOString())}` : 'Conectando…'}
          </span>
        </div>

        <div className={styles.controls}>
          {audio.supported && audio.enabled && (
            <>
              <button className={styles.ctrl} onClick={audio.toggleMute} aria-pressed={audio.muted}>
                {audio.muted ? '🔇 Audio silenciado' : audio.speaking ? '🔊 Anunciando…' : '🔊 Audio activo'}
              </button>
              <button className={styles.ctrl} onClick={repeat} disabled={audio.muted} title={audio.lastMessage ?? 'Repite el pedido más reciente por preparar'}>
                ↻ Repetir último
              </button>
            </>
          )}
          <button className={styles.ctrl} onClick={toggleFullscreen}>⛶ Pantalla completa</button>
          {user.role === 'COCINA' ? (
            <button className={styles.ctrl} onClick={logout}>Salir</button>
          ) : (
            <Link className={styles.ctrl} to="/pedidos">← Volver</Link>
          )}
        </div>
      </header>

      {audio.supported && !audio.enabled && (
        <button className={styles.enableAudio} onClick={audio.enable}>
          🔈 Toque aquí para activar los anuncios de voz
          <small>El navegador exige una interacción antes de reproducir sonido.</small>
        </button>
      )}
      {!audio.supported && (
        <div className={styles.warning}>Este navegador no soporta anuncios de voz. Use Chrome, Edge o Safari; los avisos visuales siguen activos.</div>
      )}

      {banner && (
        <div className={styles.banner} role="alert">
          🔔 {banner}
        </div>
      )}

      <main className={styles.board}>
        {COLUMNS.map((col) => {
          const list = byStatus(col.status);
          return (
            <section key={col.status} className={styles.column} data-status={col.status}>
              <h2 className={styles.columnTitle}>
                {col.title} <span className={styles.count}>{list.length}</span>
              </h2>
              <div className={styles.cards}>
                {list.length === 0 && <p className={styles.empty}>Sin pedidos</p>}
                {list.map((order) => (
                  <KitchenCard
                    key={order.id}
                    order={order}
                    now={now}
                    isNew={highlighted[order.id] > now}
                    action={order.availableStatuses.includes(col.action) ? col : null}
                    busy={busyId === order.id}
                    onAction={() => advance(order, col.action)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}

function KitchenCard({ order, now, isNew, action, busy, onAction }) {
  const minutes = minutesSince(order.createdAt, now);
  const urgency = order.status === 'LISTO' ? '' : minutes >= 25 ? styles.late : minutes >= 15 ? styles.warn : '';

  return (
    <article className={`${styles.card} ${isNew ? styles.cardNew : ''}`}>
      <header className={styles.cardHeader}>
        <span className={styles.number}>#{order.orderNumber}</span>
        <span className={`${styles.timer} ${urgency}`} title={`Recibido a las ${formatTime(order.createdAt)}`}>
          {minutes} min{urgency === styles.late ? ' · demorado' : ''}
        </span>
      </header>
      <div className={styles.tags}>
        <span className={styles.tag}>{ORDER_SOURCE[order.source].label}</span>
        {order.source !== order.type && (
          <span className={`${styles.tag} ${order.type !== 'EN_LOCAL' ? styles.tagStrong : ''}`}>{ORDER_TYPE[order.type]}</span>
        )}
        {order.customer && <span className={styles.customer}>{order.customer.name}</span>}
      </div>

      <ul className={styles.items}>
        {order.items.map((item) => (
          <li key={item.id}>
            <span className={styles.qty}>{item.quantity}×</span>
            <span>
              {item.productName}
              {item.notes && <span className={styles.itemNote}>⚠ {item.notes}</span>}
            </span>
          </li>
        ))}
      </ul>
      {order.notes && <p className={styles.orderNote}>📝 {order.notes}</p>}

      {action ? (
        <button className={`${styles.action} ${action.action === 'LISTO' ? styles.actionReady : ''}`} onClick={onAction} disabled={busy}>
          {busy ? 'Guardando…' : action.actionLabel}
        </button>
      ) : (
        order.status === 'LISTO' && (
          <p className={styles.waiting}>{order.type === 'DOMICILIO' ? 'Esperando domiciliario' : 'Esperando entrega al cliente'}</p>
        )
      )}
    </article>
  );
}

/** Hora actual que se actualiza cada `interval` ms (para cronómetros). */
function useNow(interval) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}
