import { useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useResource } from '../hooks/useResource.js';
import { completeDelivery, fetchDeliveryPersons } from '../services/deliveries.service.js';
import { getErrorMessage } from '../services/api.js';
import { TRANSPORT_TYPE } from '../utils/constants.js';
import { formatTime } from '../utils/format.js';
import { Badge, Button, Card, EmptyState } from './ui/index.jsx';
import AssignCourier from './AssignCourier.jsx';

const DELIVERY_STATUS = {
  ASIGNADO: { label: 'Asignado', tone: 'info' },
  EN_CAMINO: { label: 'En camino', tone: 'accent' },
  ENTREGADO: { label: 'Entregado', tone: 'done' },
  CANCELADO: { label: 'Cancelado', tone: 'danger' },
};

/** Tarjeta "Domiciliario" del detalle de un pedido a domicilio. */
export default function DeliveryPanel({ order, onChange }) {
  const { hasRole } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const delivery = order.delivery;
  const canDispatch = hasRole('ADMIN', 'CAJERO') && order.status === 'LISTO' && (!delivery || delivery.status === 'CANCELADO');

  async function confirm() {
    setBusy(true);
    try {
      await completeDelivery(delivery.id);
      toast.success(`Pedido #${order.orderNumber} entregado`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
      onChange();
    }
  }

  return (
    <Card title="Domiciliario" actions={delivery && <Badge tone={DELIVERY_STATUS[delivery.status].tone}>{DELIVERY_STATUS[delivery.status].label}</Badge>}>
      {delivery && delivery.status !== 'CANCELADO' ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <div>
            <strong>{delivery.deliveryPerson.name}</strong> · {delivery.deliveryPerson.phone}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Salió {formatTime(delivery.assignedAt)}
            {delivery.deliveredAt && ` · entregado ${formatTime(delivery.deliveredAt)}`}
          </div>
          {delivery.status === 'EN_CAMINO' && hasRole('ADMIN', 'CAJERO') && (
            <Button variant="success" loading={busy} onClick={confirm}>
              Confirmar entrega
            </Button>
          )}
        </div>
      ) : canDispatch ? (
        <DispatchForm order={order} onChange={onChange} />
      ) : (
        <EmptyState title="Sin asignar">Se despacha cuando cocina marque el pedido como listo.</EmptyState>
      )}
    </Card>
  );
}

function DispatchForm({ order, onChange }) {
  const load = useCallback(() => fetchDeliveryPersons({ availability: 'DISPONIBLE' }), []);
  const { data: couriers } = useResource(load, { interval: 15_000 });
  if (!couriers) return null;
  return (
    <>
      <p style={{ margin: '0 0 12px', fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
        Listo para despachar · {couriers.length} disponibles ({couriers.map((c) => `${c.name.split(' ')[0]} ${TRANSPORT_TYPE[c.transportType].toLowerCase()}`).join(', ') || 'ninguno'})
      </p>
      <AssignCourier order={order} couriers={couriers} onAssigned={onChange} />
    </>
  );
}
