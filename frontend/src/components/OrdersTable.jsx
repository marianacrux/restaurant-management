import { useNavigate } from 'react-router-dom';
import { OrderStatusBadge, PaymentStatusBadge, SourceBadge } from './OrderBadges.jsx';
import { ORDER_TYPE } from '../utils/constants.js';
import { formatMoney, formatTime, summarizeItems } from '../utils/format.js';
import styles from './OrdersTable.module.css';

/** Tabla de pedidos reutilizada en el dashboard y en el listado. Clic en una fila = detalle. */
export default function OrdersTable({ orders, showItems = false }) {
  const navigate = useNavigate();
  const open = (id) => navigate(`/pedidos/${id}`);

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Hora</th>
            <th>Cliente</th>
            <th>Canal</th>
            {showItems && <th>Productos</th>}
            <th className={styles.num}>Total</th>
            <th>Pago</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} onClick={() => open(o.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && open(o.id)}>
              <td className={styles.strong}>#{o.orderNumber}</td>
              <td>{formatTime(o.createdAt)}</td>
              <td>
                {o.customer?.name ?? <span className={styles.muted}>Mostrador</span>}
                <div className={styles.sub}>{ORDER_TYPE[o.type]}</div>
              </td>
              <td><SourceBadge source={o.source} /></td>
              {showItems && <td className={styles.items} title={summarizeItems(o.items)}>{summarizeItems(o.items)}</td>}
              <td className={styles.num}>{formatMoney(o.total)}</td>
              <td><PaymentStatusBadge status={o.status === 'CANCELADO' && o.paymentStatus === 'PENDIENTE' ? 'NO_APLICA' : o.paymentStatus} /></td>
              <td><OrderStatusBadge status={o.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
