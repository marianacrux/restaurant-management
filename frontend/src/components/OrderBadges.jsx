import { Badge } from './ui/index.jsx';
import { ORDER_SOURCE, ORDER_STATUS, PAYMENT_STATUS } from '../utils/constants.js';

export function OrderStatusBadge({ status }) {
  const s = ORDER_STATUS[status] ?? { label: status, tone: 'neutral' };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function PaymentStatusBadge({ status }) {
  const s = PAYMENT_STATUS[status] ?? { label: status, tone: 'neutral' };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function SourceBadge({ source }) {
  return <Badge tone="outline">{ORDER_SOURCE[source]?.label ?? source}</Badge>;
}
