import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import {
  createCategory,
  createProduct,
  deactivateProduct,
  fetchCategories,
  fetchProducts,
  setProductAvailability,
  updateProduct,
} from '../../services/catalog.service.js';
import { getErrorMessage } from '../../services/api.js';
import { Alert, Badge, Button, Card, EmptyState, Field, Loading, Modal, PageHeader } from '../../components/ui/index.jsx';
import { formatMoney } from '../../utils/format.js';
import shared from '../../styles/shared.module.css';
import styles from './ProductsPage.module.css';

// Catálogo único: lo que se cambie aquí se refleja en el POS, la cocina,
// las pantallas y el bot de WhatsApp (todos consultan la misma API).
export default function ProductsPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const toast = useToast();
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState(null); // producto | {} (nuevo) | null
  const [newCategory, setNewCategory] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const [categories, products] = await Promise.all([
      fetchCategories({ includeInactive: isAdmin || undefined }),
      fetchProducts({ includeInactive: (isAdmin && showInactive) || undefined }),
    ]);
    return { categories, products };
  }, [isAdmin, showInactive]);
  const { data, error, loading, reload } = useResource(load, { deps: [load] });

  const visible = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return data.products.filter(
      (p) => (!categoryId || p.category.id === Number(categoryId)) && (!term || p.name.toLowerCase().includes(term)),
    );
  }, [data, categoryId, search]);

  async function run(id, action, message) {
    setBusyId(id);
    try {
      await action();
      toast.success(message);
      reload({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const soldOut = data?.products.filter((p) => p.active && !p.available).length ?? 0;

  return (
    <>
      <PageHeader
        title="Productos"
        subtitle={isAdmin ? 'Catálogo, precios y disponibilidad en todos los canales' : 'Marque como agotado lo que ya no haya hoy'}
        actions={
          isAdmin && (
            <>
              <Button variant="secondary" onClick={() => setNewCategory(true)}>＋ Categoría</Button>
              <Button onClick={() => setEditing({})}>＋ Nuevo producto</Button>
            </>
          )
        }
      />
      {error && <Alert>{error}</Alert>}
      {loading && !data && <Loading />}

      {data && (
        <Card bodyClassName={shared.flush}>
          <div className={`${shared.toolbar} ${styles.filters}`}>
            <input
              type="search"
              className={`${shared.control} ${shared.grow}`}
              placeholder="Buscar producto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar producto"
            />
            <select className={shared.control} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Categoría">
              <option value="">Todas las categorías</option>
              {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {isAdmin && (
              <label className={shared.check}>
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                Ver retirados
              </label>
            )}
            <span className={shared.small}>{visible.length} productos · {soldOut} agotados</span>
          </div>

          {visible.length === 0 ? (
            <EmptyState title="No hay productos que coincidan" />
          ) : (
            <div className={shared.tableWrap}>
              <table className={shared.table}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th className={shared.num}>Precio</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => (
                    <tr key={p.id} className={p.active ? '' : styles.retired}>
                      <td>
                        <div className={styles.product}>
                          {p.imageUrl ? <img src={p.imageUrl} alt="" className={styles.thumb} /> : <span className={styles.thumbEmpty} aria-hidden="true">🍽</span>}
                          <div>
                            <div className={shared.strong}>{p.name}</div>
                            {p.description && <div className={shared.small}>{p.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td>{p.category.name}</td>
                      <td className={shared.num}>{formatMoney(p.price)}</td>
                      <td>
                        <div className={styles.badges}>
                          {!p.active ? (
                            <Badge tone="outline">Retirado</Badge>
                          ) : p.available ? (
                            <Badge tone="success">Disponible</Badge>
                          ) : (
                            <Badge tone="danger">Agotado</Badge>
                          )}
                          {p.isDailyMenu && <Badge tone="info">Menú del día</Badge>}
                          {p.isFeatured && <Badge tone="accent">Destacado</Badge>}
                        </div>
                      </td>
                      <td>
                        <div className={shared.actions}>
                          {p.active && (
                            <Button
                              size="sm"
                              variant={p.available ? 'secondary' : 'success'}
                              loading={busyId === p.id}
                              aria-label={`${p.available ? 'Marcar agotado' : 'Marcar disponible'}: ${p.name}`}
                              onClick={() =>
                                run(p.id, () => setProductAvailability(p.id, !p.available), `${p.name}: ${p.available ? 'agotado' : 'disponible'}`)
                              }
                            >
                              {p.available ? 'Marcar agotado' : 'Marcar disponible'}
                            </Button>
                          )}
                          {isAdmin && (
                            <Button size="sm" variant="ghost" aria-label={`Editar ${p.name}`} onClick={() => setEditing(p)}>
                              Editar
                            </Button>
                          )}
                          {isAdmin &&
                            (p.active ? (
                              <Button size="sm" variant="ghost" onClick={() => run(p.id, () => deactivateProduct(p.id), `${p.name} retirado del menú`)}>
                                Retirar
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => run(p.id, () => updateProduct(p.id, { active: true }), `${p.name} reactivado`)}>
                                Reactivar
                              </Button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {editing && data && (
        <ProductFormModal
          product={editing.id ? editing : null}
          categories={data.categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload({ silent: true });
          }}
        />
      )}
      {newCategory && (
        <CategoryModal
          onClose={() => setNewCategory(false)}
          onSaved={() => {
            setNewCategory(false);
            reload({ silent: true });
          }}
        />
      )}
    </>
  );
}

function ProductFormModal({ product, categories, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product ? String(Number(product.price)) : '',
    categoryId: product?.category.id ?? categories[0]?.id ?? '',
    imageUrl: product?.imageUrl ?? '',
    available: product?.available ?? true,
    isDailyMenu: product?.isDailyMenu ?? false,
    isFeatured: product?.isFeatured ?? false,
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function save() {
    const e = {};
    const price = Number(form.price);
    if (form.name.trim().length < 2) e.name = 'Mínimo 2 caracteres';
    if (!price || price <= 0) e.price = 'Ingrese un precio mayor que cero';
    else if (!/^\d+(\.\d{1,2})?$/.test(form.price.trim())) e.price = 'Máximo 2 decimales, sin puntos de miles';
    if (!form.categoryId) e.categoryId = 'Seleccione una categoría';
    if (form.imageUrl && !/^https?:\/\/\S+$/.test(form.imageUrl.trim()) && !form.imageUrl.startsWith('/')) e.imageUrl = 'URL http(s) válida';
    setErrors(e);
    if (Object.keys(e).length) return;

    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price,
      categoryId: Number(form.categoryId),
      imageUrl: form.imageUrl.trim() || null,
      available: form.available,
      isDailyMenu: form.isDailyMenu,
      isFeatured: form.isFeatured,
    };
    setBusy(true);
    setServerError('');
    try {
      if (product) await updateProduct(product.id, body);
      else await createProduct(body);
      toast.success(product ? 'Producto actualizado' : `${body.name} creado`);
      onSaved();
    } catch (err) {
      setServerError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={product ? `Editar · ${product.name}` : 'Nuevo producto'}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={busy}>Guardar</Button>
        </>
      }
    >
      {serverError && <Alert>{serverError}</Alert>}
      <div className={shared.formGrid}>
        <div className={shared.span2}>
          <Field label="Nombre" value={form.name} onChange={set('name')} error={errors.name} maxLength={120} autoFocus />
        </div>
        <div className={shared.span2}>
          <Field as="textarea" rows={2} label="Descripción" value={form.description} onChange={set('description')} maxLength={500} />
        </div>
        <Field label="Precio (COP)" inputMode="decimal" placeholder="19000" value={form.price} onChange={set('price')} error={errors.price} />
        <Field as="select" label="Categoría" value={form.categoryId} onChange={set('categoryId')} error={errors.categoryId}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Field>
        <div className={shared.span2}>
          <Field
            label="Imagen (URL)"
            placeholder="https://…"
            hint="Por ahora se usa una URL; más adelante se conectará un almacenamiento de imágenes."
            value={form.imageUrl}
            onChange={set('imageUrl')}
            error={errors.imageUrl}
          />
        </div>
        <label className={shared.check}><input type="checkbox" checked={form.available} onChange={set('available')} /> Disponible</label>
        <label className={shared.check}><input type="checkbox" checked={form.isDailyMenu} onChange={set('isDailyMenu')} /> Menú del día</label>
        <label className={shared.check}><input type="checkbox" checked={form.isFeatured} onChange={set('isFeatured')} /> Destacado</label>
      </div>
      {product && Number(form.price) !== Number(product.price) && (
        <p className={shared.small} style={{ marginTop: 12 }}>
          El nuevo precio aplica a pedidos nuevos; los pedidos anteriores conservan el precio con el que se vendieron.
        </p>
      )}
    </Modal>
  );
}

function CategoryModal({ onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (name.trim().length < 2) return setError('Mínimo 2 caracteres');
    setBusy(true);
    try {
      await createCategory({ name: name.trim() });
      toast.success(`Categoría ${name.trim()} creada`);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="Nueva categoría"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={busy}>Crear</Button>
        </>
      }
    >
      <Field label="Nombre" value={name} onChange={(e) => setName(e.target.value)} error={error} autoFocus maxLength={80} />
    </Modal>
  );
}
