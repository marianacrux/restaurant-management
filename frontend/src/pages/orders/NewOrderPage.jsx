import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResource } from '../../hooks/useResource.js';
import { useToast } from '../../context/ToastContext.jsx';
import { fetchCategories, fetchProducts, fetchSettings } from '../../services/catalog.service.js';
import { createOrder } from '../../services/orders.service.js';
import { getErrorMessage } from '../../services/api.js';
import { Alert, Button, Card, Field, Loading, PageHeader } from '../../components/ui/index.jsx';
import { ORDER_SOURCE, ORDER_TYPE, PAYMENT_METHOD } from '../../utils/constants.js';
import { formatMoney } from '../../utils/format.js';
import styles from './NewOrderPage.module.css';

// El punto de venta no ofrece el canal WhatsApp: esos pedidos llegan por el bot (Día 5).
const POS_SOURCES = ['PUNTO_DE_VENTA', 'VITRINA', 'DOMICILIO'];

const TYPE_ICON = { EN_LOCAL: '🍽', PARA_LLEVAR: '🥡', DOMICILIO: '🛵' };

const EMPTY_FORM = {
  source: 'PUNTO_DE_VENTA',
  type: 'EN_LOCAL',
  customerName: '',
  customerPhone: '',
  deliveryAddress: '',
  paymentMethod: '',
  notes: '',
};

/** "+57 300-555 1234" -> "3005551234" */
const normalizePhone = (v) => v.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '');

export default function NewOrderPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadCatalog = useCallback(async () => {
    const [categories, products, settings] = await Promise.all([fetchCategories(), fetchProducts(), fetchSettings()]);
    return { categories, products, settings };
  }, []);
  // Se refresca cada 30 s para reflejar productos que se agoten mientras se atiende.
  const { data, error, loading, reload } = useResource(loadCatalog, { interval: 30_000 });

  const isDelivery = form.type === 'DOMICILIO';
  const needsCustomer = isDelivery;

  const visibleProducts = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return data.products.filter(
      (p) => (category === 'all' || p.category.id === category) && (!term || p.name.toLowerCase().includes(term)),
    );
  }, [data, category, search]);

  const subtotal = cart.reduce((sum, l) => sum + Number(l.price) * l.quantity, 0);
  const deliveryFee = isDelivery ? Number(data?.settings.deliveryFee ?? 0) : 0;

  // ---------- carrito ----------
  const addProduct = (p) => {
    setCart((lines) => {
      const existing = lines.find((l) => l.productId === p.id && !l.notes);
      if (existing) return lines.map((l) => (l === existing ? { ...l, quantity: Math.min(99, l.quantity + 1) } : l));
      return [...lines, { key: `${p.id}-${Date.now()}-${Math.random()}`, productId: p.id, name: p.name, price: p.price, quantity: 1, notes: '' }];
    });
    setErrors((e) => ({ ...e, items: undefined }));
  };
  const updateLine = (key, changes) => setCart((lines) => lines.map((l) => (l.key === key ? { ...l, ...changes } : l)));
  const removeLine = (key) => setCart((lines) => lines.filter((l) => l.key !== key));

  // ---------- formulario ----------
  const setField = (field) => (e) => {
    const value = e.target.value;
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === 'source' && value === 'DOMICILIO') next.type = 'DOMICILIO';
      if (field === 'source' && value !== 'DOMICILIO' && f.type === 'DOMICILIO') next.type = 'EN_LOCAL';
      return next;
    });
    setErrors((er) => ({ ...er, [field]: undefined }));
  };

  function validate() {
    const e = {};
    if (!cart.length) e.items = 'Agregue al menos un producto';
    const phone = normalizePhone(form.customerPhone);
    const anyCustomerData = form.customerName.trim() || form.customerPhone.trim();
    if (needsCustomer || anyCustomerData) {
      if (form.customerName.trim().length < 2) e.customerName = 'Escriba el nombre del cliente';
      if (!/^\d{10}$/.test(phone)) e.customerPhone = 'El teléfono debe tener 10 dígitos';
    }
    if (isDelivery && form.deliveryAddress.trim().length < 5) e.deliveryAddress = 'Escriba la dirección completa';
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    // Solo se envían productos y cantidades: precios y totales los calcula el backend.
    const payload = {
      source: form.source,
      type: form.type,
      items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity, notes: l.notes.trim() || undefined })),
      customer: form.customerName.trim() ? { name: form.customerName.trim(), phone: normalizePhone(form.customerPhone) } : undefined,
      deliveryAddress: isDelivery ? form.deliveryAddress.trim() : undefined,
      paymentMethod: form.paymentMethod || undefined,
      notes: form.notes.trim() || undefined,
    };

    setSubmitting(true);
    setServerError('');
    try {
      const order = await createOrder(payload);
      toast.success(`Pedido #${order.orderNumber} creado · ${formatMoney(order.total)}`);
      navigate(`/pedidos/${order.id}`);
    } catch (err) {
      setServerError(getErrorMessage(err));
      if (err.response?.status === 409) reload({ silent: true }); // p. ej. un producto se agotó
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !data) return <Loading />;
  if (error && !data) return <Alert action={<Button size="sm" variant="secondary" onClick={() => reload()}>Reintentar</Button>}>{error}</Alert>;

  return (
    <>
      <PageHeader title="Nuevo pedido" subtitle="Punto de venta, vitrina o domicilio telefónico" />

      <form className={styles.layout} onSubmit={handleSubmit} noValidate>
        {/* ---------------- Catálogo ---------------- */}
        <Card className={styles.catalog}>
          <div className={styles.catalogTools}>
            <input
              type="search"
              className={styles.search}
              placeholder="Buscar producto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar producto"
            />
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Categorías">
            {[{ id: 'all', name: 'Todo' }, ...data.categories].map((c) => (
              <button
                type="button"
                role="tab"
                key={c.id}
                aria-selected={category === c.id}
                className={`${styles.tab} ${category === c.id ? styles.tabOn : ''}`}
                onClick={() => setCategory(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className={styles.products}>
            {visibleProducts.map((p) => (
              <button
                type="button"
                key={p.id}
                className={styles.product}
                disabled={!p.available}
                onClick={() => addProduct(p)}
                title={p.description ?? undefined}
                aria-label={`${p.name}, ${formatMoney(p.price)}${p.available ? '' : ', agotado'}`}
              >
                <span className={styles.productName}>{p.name}</span>
                <span className={styles.productMeta}>
                  <span className={styles.productPrice}>{formatMoney(p.price)}</span>
                  {!p.available && <span className={styles.soldOut}>Agotado</span>}
                </span>
              </button>
            ))}
            {!visibleProducts.length && <p className={styles.muted}>No hay productos que coincidan.</p>}
          </div>
        </Card>

        {/* ---------------- Pedido ---------------- */}
        <div className={styles.side}>
          <Card title={`Pedido (${cart.reduce((n, l) => n + l.quantity, 0)} productos)`}>
            {errors.items && <Alert>{errors.items}</Alert>}
            {!cart.length && !errors.items && <p className={styles.muted}>Toque un producto para agregarlo.</p>}
            <ul className={styles.cart}>
              {cart.map((l) => (
                <li key={l.key} className={styles.line}>
                  <div className={styles.lineTop}>
                    <span className={styles.lineName}>{l.name}</span>
                    <span className={styles.lineTotal}>{formatMoney(Number(l.price) * l.quantity)}</span>
                  </div>
                  <div className={styles.lineControls}>
                    <div className={styles.stepper}>
                      <button type="button" aria-label={`Quitar una unidad de ${l.name}`} onClick={() => (l.quantity > 1 ? updateLine(l.key, { quantity: l.quantity - 1 }) : removeLine(l.key))}>−</button>
                      <span aria-live="polite">{l.quantity}</span>
                      <button type="button" aria-label={`Agregar una unidad de ${l.name}`} onClick={() => updateLine(l.key, { quantity: Math.min(99, l.quantity + 1) })}>+</button>
                    </div>
                    <input
                      className={styles.lineNote}
                      placeholder="Instrucción (ej.: sin cebolla)"
                      maxLength={200}
                      value={l.notes}
                      onChange={(e) => updateLine(l.key, { notes: e.target.value })}
                      aria-label={`Instrucción para ${l.name}`}
                    />
                    <button type="button" className={styles.remove} onClick={() => removeLine(l.key)} aria-label={`Eliminar ${l.name}`}>✕</button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Datos del pedido">
            <div className={styles.formGrid}>
              {/* Tipo de entrega como botones visibles: define si el pedido va a Domicilios. */}
              <fieldset className={`${styles.span2} ${styles.typeGroup}`}>
                <legend className={styles.typeLegend}>¿Cómo se entrega?</legend>
                <div className={styles.segmented}>
                  {Object.entries(ORDER_TYPE).map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      className={`${styles.segment} ${form.type === value ? styles.segmentOn : ''}`}
                      aria-pressed={form.type === value}
                      disabled={form.source === 'DOMICILIO' && value !== 'DOMICILIO'}
                      onClick={() => setField('type')({ target: { value } })}
                    >
                      {TYPE_ICON[value]} {label}
                    </button>
                  ))}
                </div>
                {isDelivery && <span className={styles.typeHint}>Aparecerá en Domicilios cuando cocina lo marque como listo.</span>}
              </fieldset>
              <div className={styles.span2}>
                <Field as="select" label="Canal de origen" value={form.source} onChange={setField('source')}>
                  {POS_SOURCES.map((s) => <option key={s} value={s}>{ORDER_SOURCE[s].label}</option>)}
                </Field>
              </div>
              <Field
                label={`Nombre del cliente${needsCustomer ? '' : ' (opcional)'}`}
                value={form.customerName}
                onChange={setField('customerName')}
                error={errors.customerName}
                maxLength={120}
              />
              <Field
                label={`Teléfono${needsCustomer ? '' : ' (opcional)'}`}
                type="tel"
                inputMode="tel"
                placeholder="300 555 1234"
                value={form.customerPhone}
                onChange={setField('customerPhone')}
                error={errors.customerPhone}
              />
              {isDelivery && (
                <div className={styles.span2}>
                  <Field label="Dirección de entrega" placeholder="Calle 10 # 20-30, barrio" value={form.deliveryAddress} onChange={setField('deliveryAddress')} error={errors.deliveryAddress} maxLength={250} />
                </div>
              )}
              <div className={styles.span2}>
                <Field
                  as="select"
                  label="Método de pago previsto (opcional)"
                  hint="Solo informativo: el pago se registra aparte cuando se recibe el dinero."
                  value={form.paymentMethod}
                  onChange={setField('paymentMethod')}
                >
                  <option value="">Sin indicar</option>
                  {Object.entries(PAYMENT_METHOD).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </Field>
              </div>
              <div className={styles.span2}>
                <Field as="textarea" rows={2} label="Notas del pedido (opcional)" value={form.notes} onChange={setField('notes')} maxLength={500} />
              </div>
            </div>
          </Card>

          <Card>
            <dl className={styles.totals}>
              <div><dt>Subtotal</dt><dd>{formatMoney(subtotal)}</dd></div>
              <div><dt>Domicilio</dt><dd>{formatMoney(deliveryFee)}</dd></div>
              <div className={styles.total}><dt>Total estimado</dt><dd>{formatMoney(subtotal + deliveryFee)}</dd></div>
            </dl>
            <p className={styles.hint}>El total definitivo lo calcula el servidor con los precios vigentes.</p>
            {serverError && <Alert>{serverError}</Alert>}
            <Button type="submit" size="lg" block loading={submitting}>
              Crear pedido
            </Button>
          </Card>
        </div>
      </form>
    </>
  );
}
