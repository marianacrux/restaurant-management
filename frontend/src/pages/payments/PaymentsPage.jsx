import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useResource } from '../../hooks/useResource.js';
import { fetchPayments } from '../../services/payments.service.js';
import { fetchOrders } from '../../services/orders.service.js';
import { Alert, Badge, Card, EmptyState, Loading, PageHeader, StatCard } from '../../components/ui/index.jsx';
import { OrderStatusBadge, PaymentStatusBadge, SourceBadge } from '../../components/OrderBadges.jsx';
import { ORDER_SOURCE, ORDER_STATUS, PAYMENT_METHOD } from '../../utils/constants.js';
import { formatDateTime, formatMoney, todayLocal } from '../../utils/format.js';
import shared from '../../styles/shared.module.css';

const OPEN_STATUSES = Object.keys(ORDER_STATUS).filter((s) => s !== 'CANCELADO');

export default function PaymentsPage() {
  const [filters, setFilters] = useState({ from: todayLocal(), to: todayLocal(), method: '', source: '' });
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  const load = useCallback(async () => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const [payments, pending] = await Promise.all([
      fetchPayments({ ...clean, pageSize: 100 }),
      fetchOrders({ paymentStatus: ['PENDIENTE', 'PARCIAL'], status: OPEN_STATUSES, pageSize: 50 }),
    ]);
    return { payments, pending };
  }, [filters]);
  const { data, error, loading } = useResource(load, { interval: 30_000, deps: [load] });

  const pendingTotal = data?.pending.data.reduce((s, o) => s + Number(o.total), 0) ?? 0;

  return (
    <>
      <PageHeader title="Pagos" subtitle="Dinero recibido y pedidos por cobrar" />
      {error && <Alert>{error}</Alert>}
      {loading && !data && <Loading />}

      {data && (
        <div className={shared.stack}>
          <div className={shared.threeCols}>
            <StatCard label="Recibido en el periodo" value={formatMoney(data.payments.summary.collected)} hint={`${data.payments.summary.payments} pagos vigentes`} />
            <StatCard label="Pedidos por cobrar" value={data.pending.pagination.total} hint="Pendientes o con pago parcial" />
            <StatCard label="Valor por cobrar" value={formatMoney(pendingTotal)} hint="Total de esos pedidos (sin descontar abonos)" />
          </div>

          <Card title="Pendientes de cobro" bodyClassName={shared.flush}>
            {data.pending.data.length === 0 ? (
              <EmptyState title="Todo cobrado 🎉" />
            ) : (
              <div className={shared.tableWrap}>
                <table className={shared.table}>
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th>Canal</th>
                      <th>Método elegido</th>
                      <th className={shared.num}>Total</th>
                      <th>Pago</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pending.data.map((o) => (
                      <tr key={o.id}>
                        <td><Link className={shared.link} to={`/pedidos/${o.id}`}>#{o.orderNumber}</Link></td>
                        <td className={shared.nowrap}>{formatDateTime(o.createdAt)}</td>
                        <td className={shared.nowrap}>{o.customer?.name ?? <span className={shared.muted}>Mostrador</span>}</td>
                        <td><SourceBadge source={o.source} /></td>
                        <td>{o.paymentMethod ? PAYMENT_METHOD[o.paymentMethod] : <span className={shared.muted}>—</span>}</td>
                        <td className={shared.num}>{formatMoney(o.total)}</td>
                        <td><PaymentStatusBadge status={o.paymentStatus} /></td>
                        <td><OrderStatusBadge status={o.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            title="Pagos registrados"
            bodyClassName={shared.flush}
            actions={
              <div className={shared.toolbar}>
                <input type="date" className={shared.control} value={filters.from} max={filters.to} onChange={set('from')} aria-label="Desde" />
                <input type="date" className={shared.control} value={filters.to} min={filters.from} max={todayLocal()} onChange={set('to')} aria-label="Hasta" />
                <select className={shared.control} value={filters.method} onChange={set('method')} aria-label="Método de pago">
                  <option value="">Todos los métodos</option>
                  {Object.entries(PAYMENT_METHOD).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select className={shared.control} value={filters.source} onChange={set('source')} aria-label="Canal">
                  <option value="">Todos los canales</option>
                  {Object.entries(ORDER_SOURCE).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </div>
            }
          >
            {data.payments.data.length === 0 ? (
              <EmptyState title="No hay pagos con estos filtros" />
            ) : (
              <div className={shared.tableWrap}>
                <table className={shared.table}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Pedido</th>
                      <th>Canal</th>
                      <th>Método</th>
                      <th>Referencia</th>
                      <th className={shared.num}>Monto</th>
                      <th>Estado</th>
                      <th>Registró</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.data.map((p) => (
                      <tr key={p.id}>
                        <td className={shared.nowrap}>{formatDateTime(p.createdAt)}</td>
                        <td><Link className={shared.link} to={`/pedidos/${p.order.id}`}>#{p.order.orderNumber}</Link></td>
                        <td><SourceBadge source={p.order.source} /></td>
                        <td>{PAYMENT_METHOD[p.method]}</td>
                        <td className={shared.muted}>{p.reference ?? '—'}</td>
                        <td className={shared.num}>{formatMoney(p.amount)}</td>
                        <td>{p.status === 'PAGADO' ? <Badge tone="success">Pagado</Badge> : <Badge tone="neutral">Reembolsado</Badge>}</td>
                        <td>{p.recordedBy.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
