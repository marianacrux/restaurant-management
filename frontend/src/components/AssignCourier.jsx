import { useState } from 'react';
import { assignDelivery } from '../services/deliveries.service.js';
import { getErrorMessage } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { TRANSPORT_TYPE } from '../utils/constants.js';
import { Button } from './ui/index.jsx';
import shared from '../styles/shared.module.css';

/**
 * Selector de domiciliario + botón "Despachar". Solo ofrece domiciliarios
 * DISPONIBLES; el backend vuelve a validarlo (y bloquea a los ocupados).
 */
export default function AssignCourier({ order, couriers, onAssigned }) {
  const toast = useToast();
  const available = couriers.filter((c) => c.availability === 'DISPONIBLE');
  const [courierId, setCourierId] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!courierId) return toast.error('Seleccione un domiciliario disponible');
    setBusy(true);
    try {
      const delivery = await assignDelivery(order.id, Number(courierId));
      toast.success(`Pedido #${order.orderNumber} en camino con ${delivery.deliveryPerson.name}`);
      setCourierId('');
      onAssigned?.(delivery);
    } catch (err) {
      toast.error(getErrorMessage(err));
      onAssigned?.(null); // recarga para reflejar el estado real
    } finally {
      setBusy(false);
    }
  }

  if (!available.length) return <span className={shared.small}>No hay domiciliarios disponibles</span>;

  return (
    <div className={shared.toolbar}>
      <select
        className={`${shared.control} ${shared.grow}`}
        value={courierId}
        onChange={(e) => setCourierId(e.target.value)}
        aria-label={`Domiciliario para el pedido #${order.orderNumber}`}
      >
        <option value="">Seleccionar domiciliario…</option>
        {available.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} · {TRANSPORT_TYPE[c.transportType]}
          </option>
        ))}
      </select>
      <Button onClick={submit} loading={busy}>
        Despachar
      </Button>
    </div>
  );
}
