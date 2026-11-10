import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { refundPayment, registerPayment } from '../services/payments.service.js';
import { getErrorMessage } from '../services/api.js';
import { METHODS_WITH_REFERENCE, PAYMENT_METHOD } from '../utils/constants.js';
import { formatMoney, formatTime, paymentBalance } from '../utils/format.js';
import { Alert, Badge, Button, Card, Field, Modal } from './ui/index.jsx';
import { PaymentStatusBadge } from './OrderBadges.jsx';
import styles from './PaymentPanel.module.css';

/**
 * Pagos de un pedido: saldo, pagos registrados, registro de un nuevo pago
 * (ADMIN/CAJERO) y reembolsos (ADMIN). El backend valida el saldo de nuevo.
 */
export default function PaymentPanel({ order, onChange }) {
  const { hasRole } = useAuth();
  const toast = useToast();
  const { paid, balance } = paymentBalance(order);
  const cancelled = order.status === 'CANCELADO';
  const canRegister = hasRole('ADMIN', 'CAJERO') && !cancelled && balance > 0;

  const [form, setForm] = useState(null); // null = formulario cerrado
  const [refunding, setRefunding] = useState(null);

  const openForm = () =>
    setForm({ method: order.paymentMethod ?? 'EFECTIVO', amount: String(balance), reference: '', error: '', busy: false });

  async function submit(e) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return setForm((f) => ({ ...f, error: 'Ingrese un monto mayor que cero' }));
    if (amount > balance) return setForm((f) => ({ ...f, error: `El monto no puede superar el saldo (${formatMoney(balance)})` }));
    setForm((f) => ({ ...f, busy: true, error: '' }));
    try {
      await registerPayment({ orderId: order.id, method: form.method, amount, reference: form.reference.trim() || undefined });
      toast.success(`Pago de ${formatMoney(amount)} registrado`);
      setForm(null);
      onChange();
    } catch (err) {
      setForm((f) => ({ ...f, busy: false, error: getErrorMessage(err) }));
    }
  }

  return (
    <Card title="Pago" actions={<PaymentStatusBadge status={cancelled && !order.payments.length ? 'NO_APLICA' : order.paymentStatus} />}>
      {cancelled && !order.payments.length ? (
        <p className={styles.hint}>Pedido cancelado: no hay cobros pendientes.</p>
      ) : (
        <dl className={styles.summary}>
          <div><dt>Total</dt><dd>{formatMoney(order.total)}</dd></div>
          <div><dt>Pagado</dt><dd>{formatMoney(paid)}</dd></div>
          <div className={styles.balance}><dt>Saldo</dt><dd>{formatMoney(balance)}</dd></div>
        </dl>
      )}
      <p className={styles.method}>
        Método elegido por el cliente: <strong>{order.paymentMethod ? PAYMENT_METHOD[order.paymentMethod] : 'sin indicar'}</strong>
      </p>

      {order.payments.length > 0 && (
        <ul className={styles.list}>
          {order.payments.map((p) => (
            <li key={p.id} className={p.status === 'REEMBOLSADO' ? styles.refunded : ''}>
              <div className={styles.row}>
                <span>
                  <strong>{formatMoney(p.amount)}</strong> · {PAYMENT_METHOD[p.method]}
                  {p.reference && <span className={styles.ref}> · Ref. {p.reference}</span>}
                </span>
                {p.status === 'REEMBOLSADO' ? (
                  <Badge tone="neutral">Reembolsado</Badge>
                ) : (
                  hasRole('ADMIN') && (
                    <Button size="sm" variant="ghost" onClick={() => setRefunding(p)}>
                      Reembolsar
                    </Button>
                  )
                )}
              </div>
              <div className={styles.meta}>
                {formatTime(p.createdAt)} · {p.recordedBy?.name}
                {p.notes && ` · ${p.notes}`}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canRegister && !form && (
        <Button block onClick={openForm}>
          Registrar pago
        </Button>
      )}

      {form && (
        <form className={styles.form} onSubmit={submit} noValidate>
          {form.error && <Alert>{form.error}</Alert>}
          <Field as="select" label="Método" value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}>
            {Object.entries(PAYMENT_METHOD).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Field>
          <Field
            label="Monto recibido"
            type="number"
            min="1"
            step="any"
            inputMode="decimal"
            value={form.amount}
            hint={`Saldo pendiente: ${formatMoney(balance)}`}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
          {METHODS_WITH_REFERENCE.includes(form.method) && (
            <Field
              label="Referencia / número de transacción"
              value={form.reference}
              maxLength={100}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
            />
          )}
          <div className={styles.formActions}>
            <Button variant="secondary" type="button" onClick={() => setForm(null)}>Cancelar</Button>
            <Button type="submit" loading={form.busy}>Guardar pago</Button>
          </div>
        </form>
      )}

      {refunding && <RefundModal payment={refunding} onClose={() => setRefunding(null)} onDone={() => { setRefunding(null); onChange(); }} toast={toast} />}
    </Card>
  );
}

function RefundModal({ payment, onClose, onDone, toast }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (reason.trim().length < 3) return setError('Indique el motivo del reembolso');
    setBusy(true);
    try {
      await refundPayment(payment.id, reason.trim());
      toast.success('Pago reembolsado');
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={`Reembolsar ${formatMoney(payment.amount)}`}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Volver</Button>
          <Button variant="danger" loading={busy} onClick={confirm}>Reembolsar</Button>
        </>
      }
    >
      <Field as="textarea" rows={2} label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} error={error} autoFocus />
    </Modal>
  );
}
