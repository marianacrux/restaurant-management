import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { fetchOrders } from '../../services/orders.service.js';
import { completeDelivery, fetchDeliveries, fetchDeliveryPersons, setDeliveryPersonAvailability } from '../../services/deliveries.service.js';
import { getErrorMessage } from '../../services/api.js';
import { Alert, Badge, Button, Card, EmptyState, Loading, PageHeader } from '../../components/ui/index.jsx';
import AssignCourier from '../../components/AssignCourier.jsx';
import CourierFormModal from '../../components/CourierFormModal.jsx';
import { COURIER_STATUS, TRANSPORT_TYPE } from '../../utils/constants.js';
import { formatMoney, formatTime, minutesSince } from '../../utils/format.js';
import shared from '../../styles/shared.module.css';
import styles from './DeliveriesPage.module.css';

const REFRESH_MS = 10_000;

export default function DeliveriesPage() {
  const { hasRole } = useAuth();
  const toast = useToast();
  const [modal, setModal] = useState(null); // { courier } | null
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const [ready, onTheWay, couriers, counterReady] = await Promise.all([
      fetchOrders({ type: 'DOMICILIO', status: ['LISTO'], sort: 'asc', pageSize: 50 }),
      fetchDeliveries({ status: 'EN_CAMINO' }),
      fetchDeliveryPersons({ includeInactive: hasRole('ADMIN') }),
      // Pedidos listos que NO son a domicilio: se entregan en mostrador, no aquí.
      fetchOrders({ type: ['EN_LOCAL', 'PARA_LLEVAR'], status: ['LISTO'], pageSize: 1 }),
    ]);
    return { ready: ready.data, onTheWay, couriers, counterReady: counterReady.pagination.total };
  }, [hasRole]);
  const { data, error, loading, reload } = useResource(load, { interval: REFRESH_MS });
  const refresh = () => reload({ silent: true });

  async function confirm(delivery) {
    setBusyId(`d${delivery.id}`);
    try {
      await completeDelivery(delivery.id);
      toast.success(`Pedido #${delivery.order.orderNumber} entregado`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
      refresh();
    }
  }

  async function toggleAvailability(courier) {
    setBusyId(`c${courier.id}`);
    try {
      const next = courier.availability === 'DISPONIBLE' ? 'INACTIVO' : 'DISPONIBLE';
      await setDeliveryPersonAvailability(courier.id, next);
      toast.success(`${courier.name}: ${COURIER_STATUS[next].label}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
      refresh();
    }
  }

  if (loading && !data) return <Loading />;

  return (
    <>
      <PageHeader
        title="Domicilios"
        subtitle="Despacho de pedidos y estado de los domiciliarios · se actualiza cada 10 s"
        actions={hasRole('ADMIN') && <Button onClick={() => setModal({ courier: null })}>＋ Nuevo domiciliario</Button>}
      />
      {error && <Alert>{error}</Alert>}

      {data && (
        <div className={shared.stack}>
          <div className={shared.twoCols}>
            <Card title={`Listos para despachar (${data.ready.length})`}>
              {data.ready.length === 0 ? (
                <EmptyState title="Nada por despachar">
                  Aquí aparecen los pedidos con entrega <strong>Domicilio</strong> cuando cocina los marca como listos.
                  {data.counterReady > 0 && (
                    <p className={styles.counterHint}>
                      Hay {data.counterReady} {data.counterReady === 1 ? 'pedido listo' : 'pedidos listos'} para entregar en el local o para llevar.{' '}
                      <Link className={shared.link} to="/pedidos?status=LISTO">Ver en Pedidos →</Link>
                    </p>
                  )}
                </EmptyState>
              ) : (
                <ul className={styles.list}>
                  {data.ready.map((o) => (
                    <li key={o.id} className={styles.item}>
                      <div className={styles.itemHead}>
                        <Link to={`/pedidos/${o.id}`} className={styles.number}>#{o.orderNumber}</Link>
                        <span className={shared.small}>Listo hace {minutesSince(o.updatedAt)} min</span>
                      </div>
                      <div className={styles.address}>📍 {o.deliveryAddress}</div>
                      <div className={shared.muted}>
                        {o.customer?.name} · {o.customer?.phone} · <strong>{formatMoney(o.total)}</strong>
                      </div>
                      <AssignCourier order={o} couriers={data.couriers} onAssigned={refresh} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title={`En camino (${data.onTheWay.length})`}>
              {data.onTheWay.length === 0 ? (
                <EmptyState title="Sin entregas en curso" />
              ) : (
                <ul className={styles.list}>
                  {data.onTheWay.map((d) => (
                    <li key={d.id} className={styles.item}>
                      <div className={styles.itemHead}>
                        <Link to={`/pedidos/${d.order.id}`} className={styles.number}>#{d.order.orderNumber}</Link>
                        <span className={shared.small}>Salió {formatTime(d.assignedAt)} · {minutesSince(d.assignedAt)} min</span>
                      </div>
                      <div className={styles.address}>📍 {d.order.deliveryAddress}</div>
                      <div className={shared.muted}>
                        🛵 {d.deliveryPerson.name} · {d.deliveryPerson.phone}
                      </div>
                      <div>
                        <Button variant="success" size="sm" loading={busyId === `d${d.id}`} onClick={() => confirm(d)}>
                          Confirmar entrega
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card title="Domiciliarios" bodyClassName={shared.flush}>
            <div className={shared.tableWrap}>
              <table className={shared.table}>
                <thead>
                  <tr>
                    <th>Domiciliario</th>
                    <th>Transporte</th>
                    <th>Estado</th>
                    <th>Entrega actual</th>
                    <th className={shared.num}>Entregas hoy</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.couriers.map((c) => (
                    <tr key={c.id} className={c.active ? '' : styles.inactiveRow}>
                      <td className={`${shared.strong} ${shared.nowrap}`}>
                        {c.name}
                        <div className={shared.small}>
                          {c.phone}
                          {c.user && ' · con acceso a la app'}
                        </div>
                      </td>
                      <td>{TRANSPORT_TYPE[c.transportType]}</td>
                      <td>
                        {c.active ? (
                          <Badge tone={COURIER_STATUS[c.availability].tone}>{COURIER_STATUS[c.availability].label}</Badge>
                        ) : (
                          <Badge tone="outline">Desactivado</Badge>
                        )}
                      </td>
                      <td>
                        {c.activeDelivery ? (
                          <Link className={shared.link} to={`/pedidos/${c.activeDelivery.order.id}`}>
                            #{c.activeDelivery.order.orderNumber}
                          </Link>
                        ) : (
                          <span className={shared.muted}>—</span>
                        )}
                      </td>
                      <td className={shared.num}>{c.deliveredToday}</td>
                      <td>
                        <div className={shared.actions}>
                          {c.active && c.availability !== 'OCUPADO' && (
                            <Button size="sm" variant="secondary" loading={busyId === `c${c.id}`} onClick={() => toggleAvailability(c)}>
                              {c.availability === 'DISPONIBLE' ? 'Inactivar' : 'Activar'}
                            </Button>
                          )}
                          {hasRole('ADMIN') && (
                            <Button size="sm" variant="ghost" onClick={() => setModal({ courier: c })}>
                              Editar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {modal && (
        <CourierFormModal
          open
          courier={modal.courier}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refresh();
          }}
        />
      )}
    </>
  );
}
