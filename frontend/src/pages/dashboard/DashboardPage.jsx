import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useResource } from '../../hooks/useResource.js';
import { fetchSalesByDay, fetchSummary } from '../../services/dashboard.service.js';
import { fetchOrders } from '../../services/orders.service.js';
import { Alert, Button, Card, Loading, PageHeader, StatCard } from '../../components/ui/index.jsx';
import { BarList, ColumnChart } from '../../components/charts/Charts.jsx';
import OrdersTable from '../../components/OrdersTable.jsx';
import { ORDER_SOURCE, ORDER_STATUS, PAYMENT_METHOD } from '../../utils/constants.js';
import { formatMoney, formatShortDay, formatTime, todayLocal } from '../../utils/format.js';
import styles from './DashboardPage.module.css';

const REFRESH_MS = 30_000;
const PIPELINE = ['PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO'];

export default function DashboardPage() {
  const [day, setDay] = useState(todayLocal());

  const load = useCallback(async () => {
    const [summary, sales, recent] = await Promise.all([
      fetchSummary(day),
      fetchSalesByDay({ to: day }),
      fetchOrders({ pageSize: 8 }),
    ]);
    return { summary, sales, recent: recent.data };
  }, [day]);

  const { data, error, loading, lastUpdated, reload } = useResource(load, { interval: REFRESH_MS, deps: [day] });

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={lastUpdated ? `Actualizado ${formatTime(lastUpdated.toISOString())} · se refresca cada 30 s` : 'Resumen de la operación'}
        actions={
          <>
            <input
              type="date"
              className={styles.dateInput}
              value={day}
              max={todayLocal()}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              aria-label="Día del resumen"
            />
            <Button variant="secondary" onClick={() => reload()}>
              Actualizar
            </Button>
          </>
        }
      />

      {error && <Alert action={<Button size="sm" variant="secondary" onClick={() => reload()}>Reintentar</Button>}>{error}</Alert>}
      {loading && !data && <Loading />}

      {data && <DashboardContent data={data} />}
    </>
  );
}

function DashboardContent({ data }) {
  const { summary, sales, recent } = data;
  const s = summary.sales;
  const byStatus = summary.orders.byStatus;
  const activeOrders = summary.orders.total - byStatus.ENTREGADO - byStatus.CANCELADO;

  return (
    <div className={styles.grid}>
      <div className={styles.kpis}>
        <StatCard label="Ventas del día" value={formatMoney(s.total)} hint={`${summary.orders.total - byStatus.CANCELADO} pedidos válidos · sin cancelados`} />
        <StatCard label="Ventas completadas" value={formatMoney(s.delivered)} hint={`${byStatus.ENTREGADO} pedidos entregados`} />
        <StatCard label="Dinero recibido" value={formatMoney(s.collected)} hint="Pagos registrados en caja" />
        <StatCard
          label="Pagos pendientes"
          value={summary.pendingPayments.orders}
          hint={`${formatMoney(summary.pendingPayments.amount)} por cobrar`}
        />
      </div>

      <Card title="Estado de los pedidos de hoy" className={styles.full} actions={<span className={styles.muted}>{activeOrders} en curso</span>}>
        <div className={styles.pipeline}>
          {PIPELINE.map((status) => (
            <Link key={status} to={`/pedidos?status=${status}`} className={styles.pipelineItem} data-tone={ORDER_STATUS[status].tone}>
              <span className={styles.pipelineCount}>{byStatus[status]}</span>
              <span className={styles.pipelineLabel}>{ORDER_STATUS[status].label}</span>
            </Link>
          ))}
        </div>
      </Card>

      <Card title="Ventas por canal">
        <BarList
          emptyText="Aún no hay ventas en este día"
          rows={summary.bySource.map((r) => ({
            key: r.source,
            label: ORDER_SOURCE[r.source].label,
            value: Number(r.total),
            display: formatMoney(r.total),
            hint: `${r.orders} ${r.orders === 1 ? 'pedido' : 'pedidos'}`,
          }))}
        />
      </Card>

      <Card title="Dinero recibido por método de pago">
        <BarList
          emptyText="No hay pagos registrados en este día."
          rows={summary.byPaymentMethod.map((r) => ({
            key: r.method,
            label: PAYMENT_METHOD[r.method],
            value: Number(r.total),
            display: formatMoney(r.total),
            hint: `${r.payments} ${r.payments === 1 ? 'pago' : 'pagos'}`,
          }))}
        />
      </Card>

      <Card title="Ventas de los últimos 7 días" className={styles.full}>
        <ColumnChart
          caption="Ventas por día, últimos 7 días"
          points={sales.map((d) => ({
            key: d.day,
            label: formatShortDay(d.day),
            value: Number(d.total),
            display: formatMoney(d.total),
            hint: `${d.orders} pedidos`,
          }))}
        />
      </Card>

      <Card title="Pedidos recientes" className={styles.full} actions={<Link to="/pedidos" className={styles.link}>Ver todos →</Link>} bodyClassName={styles.flushBody}>
        {recent.length === 0 ? <p className={styles.emptyText}>Todavía no hay pedidos.</p> : <OrdersTable orders={recent} />}
      </Card>
    </div>
  );
}
