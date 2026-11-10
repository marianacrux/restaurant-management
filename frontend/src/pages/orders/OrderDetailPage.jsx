import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useResource } from '../../hooks/useResource.js';
import { useToast } from '../../context/ToastContext.jsx';
import { changeOrderStatus, fetchOrder } from '../../services/orders.service.js';
import { getErrorMessage } from '../../services/api.js';
import { Alert, Button, Card, EmptyState, Field, Loading, Modal, PageHeader } from '../../components/ui/index.jsx';
import { OrderStatusBadge, PaymentStatusBadge, SourceBadge } from '../../components/OrderBadges.jsx';
import { ORDER_STATUS, ORDER_TYPE, PAYMENT_METHOD, STATUS_ACTION_LABEL } from '../../utils/constants.js';
import { formatDateTime, formatMoney, formatTime } from '../../utils/format.js';
import styles from './OrderDetailPage.module.css';

export default function OrderDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const load = useCallback(() => fetchOrder(id), [id]);
  const { data: order, error, loading, reload, setData } = useResource(load, { interval: 15_000, deps: [id] });
  const [busy, setBusy] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);

  async function applyStatus(status, extra = {}) {
    setBusy(status);
    try {
      const updated = await changeOrderStatus(order.id, { status, ...extra });
      setData(updated);
      toast.success(`Pedido #${updated.orderNumber}: ${ORDER_STATUS[status].label}`);
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      reload({ silent: true });
      return false;
    } finally {
      setBusy('');
    }
  }

  if (loading && !order) return <Loading />;
  if (error && !order) {
    return (
      <>
        <PageHeader title="Pedido" />
        <Alert action={<Link to="/pedidos">Volver al listado</Link>}>{error}</Alert>
      </>
    );
  }

  const actions = order.availableStatuses.filter((s) => s !== 'CANCELADO');
  const canCancel = order.availableStatuses.includes('CANCELADO');
  const isDelivery = order.type === 'DOMICILIO';

  return (
    <>
      <Link to="/pedidos" className={styles.back}>← Pedidos</Link>
      <PageHeader
        title={
          <span className={styles.titleRow}>
            Pedido #{order.orderNumber} <OrderStatusBadge status={order.status} />
          </span>
        }
        subtitle={`${formatDateTime(order.createdAt)} · ${ORDER_TYPE[order.type]}`}
        actions={
          <>
            {canCancel && (
              <Button variant="ghost" onClick={() => setCancelOpen(true)} disabled={Boolean(busy)}>
                Cancelar pedido
              </Button>
            )}
            {actions.map((s) => (
              <Button key={s} variant={s === 'LISTO' ? 'success' : 'primary'} loading={busy === s} disabled={Boolean(busy)} onClick={() => applyStatus(s)}>
                {STATUS_ACTION_LABEL[s]}
              </Button>
            ))}
          </>
        }
      />

      {order.status === 'CANCELADO' && <Alert>Cancelado: {order.cancelReason}</Alert>}
      {isDelivery && order.status === 'LISTO' && !order.delivery && (
        <Alert type="info">Pedido listo para despachar. La asignación de domiciliario se habilita en el Día 4 (módulo de domicilios).</Alert>
      )}

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          <Card title="Productos" bodyClassName={styles.flush}>
            <table className={styles.items}>
              <thead>
                <tr>
                  <th>Cant.</th>
                  <th>Producto</th>
                  <th className={styles.num}>Unitario</th>
                  <th className={styles.num}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className={styles.qty}>{item.quantity}</td>
                    <td>
                      {item.productName}
                      {item.notes && <div className={styles.note}>✎ {item.notes}</div>}
                    </td>
                    <td className={styles.num}>{formatMoney(item.unitPrice)}</td>
                    <td className={styles.num}>{formatMoney(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className={styles.totals}>
              <div><dt>Subtotal</dt><dd>{formatMoney(order.subtotal)}</dd></div>
              {Number(order.discount) > 0 && <div><dt>Descuento</dt><dd>−{formatMoney(order.discount)}</dd></div>}
              <div><dt>Domicilio</dt><dd>{formatMoney(order.deliveryFee)}</dd></div>
              <div className={styles.grandTotal}><dt>Total</dt><dd>{formatMoney(order.total)}</dd></div>
            </dl>
          </Card>

          <Card title="Historial">
            <ol className={styles.timeline}>
              {order.statusHistory.map((h) => (
                <li key={h.id} className={styles.event}>
                  <span className={styles.dot} data-tone={ORDER_STATUS[h.newStatus].tone} aria-hidden="true" />
                  <div>
                    <div className={styles.eventTitle}>
                      {h.previousStatus && h.previousStatus !== h.newStatus
                        ? `${ORDER_STATUS[h.previousStatus].label} → ${ORDER_STATUS[h.newStatus].label}`
                        : h.previousStatus
                          ? 'Modificación'
                          : `Creado como ${ORDER_STATUS[h.newStatus].label}`}
                    </div>
                    <div className={styles.eventMeta}>
                      {formatTime(h.createdAt)} · {h.changedBy?.name ?? 'Sistema'}
                      {h.note && ` · ${h.note}`}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className={styles.sideCol}>
          <Card title="Cliente y entrega">
            <dl className={styles.info}>
              <dt>Cliente</dt>
              <dd>{order.customer?.name ?? 'Cliente de mostrador'}</dd>
              {order.customer?.phone && (<><dt>Teléfono</dt><dd>{order.customer.phone}</dd></>)}
              <dt>Canal</dt>
              <dd><SourceBadge source={order.source} /></dd>
              <dt>Entrega</dt>
              <dd>{ORDER_TYPE[order.type]}</dd>
              {order.deliveryAddress && (<><dt>Dirección</dt><dd>{order.deliveryAddress}</dd></>)}
              {order.notes && (<><dt>Notas</dt><dd className={styles.noteText}>{order.notes}</dd></>)}
              <dt>Registrado por</dt>
              <dd>{order.createdBy?.name ?? 'Bot / sistema'}</dd>
            </dl>
          </Card>

          <Card title="Pago">
            <dl className={styles.info}>
              <dt>Estado</dt>
              <dd><PaymentStatusBadge status={order.paymentStatus} /></dd>
              <dt>Método elegido</dt>
              <dd>{order.paymentMethod ? PAYMENT_METHOD[order.paymentMethod] : 'Sin indicar'}</dd>
            </dl>
            {order.payments.length === 0 ? (
              <p className={styles.hint}>Sin pagos registrados. El registro de pagos se habilita en el Día 4.</p>
            ) : (
              <ul className={styles.payments}>
                {order.payments.map((p) => (
                  <li key={p.id}>
                    {PAYMENT_METHOD[p.method]} · {formatMoney(p.amount)} · {formatTime(p.createdAt)}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {isDelivery && (
            <Card title="Domiciliario">
              {order.delivery ? (
                <p className={styles.infoLine}>{order.delivery.deliveryPerson.name} · {order.delivery.deliveryPerson.phone}</p>
              ) : (
                <EmptyState title="Sin asignar">
                  {order.status === 'LISTO' ? 'Listo para asignar (módulo de domicilios, Día 4).' : 'Se asigna cuando el pedido esté listo.'}
                </EmptyState>
              )}
            </Card>
          )}
        </div>
      </div>

      <CancelModal
        open={cancelOpen}
        orderNumber={order.orderNumber}
        busy={busy === 'CANCELADO'}
        onClose={() => setCancelOpen(false)}
        onConfirm={async (reason) => (await applyStatus('CANCELADO', { cancelReason: reason })) && setCancelOpen(false)}
      />
    </>
  );
}

function CancelModal({ open, orderNumber, busy, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (reason.trim().length < 3) return setError('Escriba el motivo (mínimo 3 caracteres)');
    setError('');
    onConfirm(reason.trim());
  };

  return (
    <Modal
      open={open}
      title={`Cancelar pedido #${orderNumber}`}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Volver</Button>
          <Button variant="danger" loading={busy} onClick={submit}>Cancelar pedido</Button>
        </>
      }
    >
      <Field
        as="textarea"
        rows={3}
        label="Motivo de la cancelación"
        placeholder="Ej.: el cliente desistió del pedido"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={error}
        autoFocus
      />
    </Modal>
  );
}
