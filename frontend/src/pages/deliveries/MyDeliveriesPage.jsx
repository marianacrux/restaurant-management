import { useCallback, useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { completeDelivery, fetchDeliveries } from '../../services/deliveries.service.js';
import { getErrorMessage } from '../../services/api.js';
import { Alert, Button, Card, EmptyState, Loading, Modal, PageHeader } from '../../components/ui/index.jsx';
import { PaymentStatusBadge } from '../../components/OrderBadges.jsx';
import { PAYMENT_METHOD } from '../../utils/constants.js';
import { formatMoney, formatTime } from '../../utils/format.js';
import styles from './MyDeliveriesPage.module.css';

// Vista del domiciliario (pensada para celular): sus entregas en curso y las de hoy.
export default function MyDeliveriesPage() {
  const toast = useToast();
  const load = useCallback(() => fetchDeliveries(), []);
  const { data, error, loading, reload } = useResource(load, { interval: 15_000 });
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await completeDelivery(confirming.id);
      toast.success(`Pedido #${confirming.order.orderNumber} entregado`);
      setConfirming(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
      reload({ silent: true });
    }
  }

  if (loading && !data) return <Loading />;

  const active = (data ?? []).filter((d) => d.status === 'EN_CAMINO' || d.status === 'ASIGNADO');
  const done = (data ?? []).filter((d) => d.status === 'ENTREGADO').slice(0, 10);

  return (
    <>
      <PageHeader title="Mis entregas" subtitle="Se actualiza cada 15 s" />
      {error && <Alert>{error}</Alert>}

      {active.length === 0 ? (
        <Card>
          <EmptyState title="No tiene entregas asignadas">Cuando caja le asigne un pedido aparecerá aquí.</EmptyState>
        </Card>
      ) : (
        <div className={styles.cards}>
          {active.map((d) => {
            const o = d.order;
            const toCollect = o.paymentStatus !== 'PAGADO';
            return (
              <article key={d.id} className={styles.card}>
                <header className={styles.head}>
                  <span className={styles.number}>Pedido #{o.orderNumber}</span>
                  <span className={styles.time}>Salió {formatTime(d.assignedAt)}</span>
                </header>
                <p className={styles.address}>📍 {o.deliveryAddress}</p>
                <p className={styles.customer}>
                  {o.customer?.name} ·{' '}
                  <a href={`tel:${o.customer?.phone}`} className={styles.phone}>
                    📞 {o.customer?.phone}
                  </a>
                </p>
                <ul className={styles.items}>
                  {o.items.map((i) => (
                    <li key={i.id}>
                      {i.quantity}× {i.productName}
                    </li>
                  ))}
                </ul>
                {o.notes && <p className={styles.note}>📝 {o.notes}</p>}
                <div className={`${styles.collect} ${toCollect ? styles.collectDue : ''}`}>
                  <div>
                    <div className={styles.collectLabel}>{toCollect ? 'Cobrar al cliente' : 'Ya pagado'}</div>
                    <div className={styles.collectAmount}>{formatMoney(o.total)}</div>
                  </div>
                  <div className={styles.collectMeta}>
                    <PaymentStatusBadge status={o.paymentStatus} />
                    <div>{o.paymentMethod ? PAYMENT_METHOD[o.paymentMethod] : 'Método sin indicar'}</div>
                  </div>
                </div>
                <Button variant="success" size="lg" block onClick={() => setConfirming(d)}>
                  Confirmar entrega
                </Button>
              </article>
            );
          })}
        </div>
      )}

      {done.length > 0 && (
        <Card title="Entregadas recientemente" className={styles.done}>
          <ul className={styles.doneList}>
            {done.map((d) => (
              <li key={d.id}>
                <strong>#{d.order.orderNumber}</strong> · {d.order.deliveryAddress} · {formatTime(d.deliveredAt)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={Boolean(confirming)}
        title={`¿Entregó el pedido #${confirming?.order.orderNumber}?`}
        onClose={() => setConfirming(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)}>Volver</Button>
            <Button variant="success" loading={busy} onClick={confirm}>Sí, entregado</Button>
          </>
        }
      >
        <p>El pedido quedará como ENTREGADO y usted volverá a estar disponible.</p>
        {confirming && confirming.order.paymentStatus !== 'PAGADO' && (
          <Alert type="warning">Recuerde cobrar {formatMoney(confirming.order.total)} y entregar el dinero en caja.</Alert>
        )}
      </Modal>
    </>
  );
}
