import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { fetchPromotions, fetchScreenConfig, fetchScreens, saveScreenContent } from '../../services/screens.service.js';
import { fetchProducts } from '../../services/catalog.service.js';
import { getErrorMessage } from '../../services/api.js';
import { Alert, Badge, Button, ButtonLink, Card, Field, Loading, PageHeader } from '../../components/ui/index.jsx';
import { formatMoney } from '../../utils/format.js';
import shared from '../../styles/shared.module.css';
import styles from './ScreensAdminPage.module.css';

const TYPE_LABEL = { PRODUCTO: 'Producto', PROMOCION: 'Promoción', ANUNCIO: 'Anuncio' };

/** Convierte un contenido guardado en un elemento editable. */
const toDraft = (c) => ({
  key: `${c.id}`,
  contentType: c.contentType,
  productId: c.productId,
  promotionId: c.promotionId,
  title: c.title ?? '',
  description: c.description ?? '',
  imageUrl: c.imageUrl ?? '',
  active: c.active,
  label: c.product?.name ?? c.promotion?.name ?? c.title,
  extra: c.product ? `${formatMoney(c.product.price)}${c.product.available ? '' : ' · agotado'}${c.product.active ? '' : ' · retirado'}` : c.promotion ? (c.promotion.active ? 'promoción' : 'promoción inactiva') : c.description,
});

export default function ScreensAdminPage() {
  const toast = useToast();
  const [selected, setSelected] = useState(1);
  const [draft, setDraft] = useState(null); // { name, active, items[] }
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [announcement, setAnnouncement] = useState({ title: '', description: '', imageUrl: '' });

  const loadLists = useCallback(async () => {
    const [screens, products, promotions] = await Promise.all([fetchScreens(), fetchProducts(), fetchPromotions()]);
    return { screens, products, promotions };
  }, []);
  const { data: lists, error, reload: reloadLists } = useResource(loadLists);

  const loadConfig = useCallback(() => fetchScreenConfig(selected), [selected]);
  const { data: config, loading: loadingConfig, reload: reloadConfig } = useResource(loadConfig, { deps: [selected] });

  useEffect(() => {
    if (config) setDraft({ name: config.name, active: config.active, items: config.contents.map(toDraft) });
  }, [config]);

  const dirty = config && draft && JSON.stringify(draft.items.map(strip)) !== JSON.stringify(config.contents.map(toDraft).map(strip));

  const update = (items) => setDraft((d) => ({ ...d, items }));
  const move = (index, delta) => {
    const items = [...draft.items];
    const [it] = items.splice(index, 1);
    items.splice(index + delta, 0, it);
    update(items);
  };
  const add = (item) => update([...draft.items, { key: `new-${Date.now()}-${Math.random()}`, active: true, title: '', description: '', imageUrl: '', ...item }]);

  async function save() {
    setSaving(true);
    try {
      await saveScreenContent(selected, {
        name: draft.name,
        active: draft.active,
        items: draft.items.map(({ contentType, productId, promotionId, title, description, imageUrl, active }) => ({
          contentType,
          productId: productId ?? null,
          promotionId: promotionId ?? null,
          title: title || null,
          description: description || null,
          imageUrl: imageUrl || null,
          active,
        })),
      });
      toast.success(`Pantalla ${selected} actualizada`);
      await Promise.all([reloadConfig({ silent: true }), reloadLists({ silent: true })]);
      setPreviewKey((k) => k + 1);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (error) return <Alert>{error}</Alert>;
  if (!lists) return <Loading />;

  const usedProducts = new Set(draft?.items.filter((i) => i.contentType === 'PRODUCTO').map((i) => i.productId));
  const usedPromos = new Set(draft?.items.filter((i) => i.contentType === 'PROMOCION').map((i) => i.promotionId));

  return (
    <>
      <PageHeader title="Pantallas digitales" subtitle="Elija qué muestra cada televisor del restaurante" />

      <div className={styles.tabs} role="tablist">
        {lists.screens.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={selected === s.screenNumber}
            className={`${styles.tab} ${selected === s.screenNumber ? styles.tabOn : ''}`}
            onClick={() => {
              if (dirty && !window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) return;
              setSelected(s.screenNumber);
            }}
          >
            <span className={styles.tabNumber}>{s.screenNumber}</span>
            <span>
              {s.name}
              <span className={styles.tabMeta}>{s._count.contents} elementos{s.active ? '' : ' · en pausa'}</span>
            </span>
          </button>
        ))}
      </div>

      {(loadingConfig && !draft) || !draft ? (
        <Loading />
      ) : (
        <div className={styles.layout}>
          <div className={shared.stack}>
            <Card
              title={`Contenido de la pantalla ${selected}`}
              actions={
                <div className={shared.toolbar}>
                  <ButtonLink to={`/pantalla/${selected}`} variant="secondary" size="sm" target="_blank" rel="noreferrer">
                    Abrir pantalla ↗
                  </ButtonLink>
                  <Button size="sm" onClick={save} loading={saving} disabled={!dirty && draft.name === config.name && draft.active === config.active}>
                    Guardar cambios
                  </Button>
                </div>
              }
            >
              <div className={styles.screenMeta}>
                <Field label="Nombre visible" value={draft.name} maxLength={80} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                <label className={shared.check}>
                  <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))} />
                  Pantalla activa
                </label>
              </div>

              {dirty && <Alert type="warning">Tiene cambios sin guardar.</Alert>}

              {draft.items.length === 0 ? (
                <p className={shared.muted}>La pantalla está vacía. Agregue productos, promociones o anuncios.</p>
              ) : (
                <ol className={styles.items}>
                  {draft.items.map((item, i) => (
                    <li key={item.key} className={`${styles.item} ${item.active ? '' : styles.itemOff}`}>
                      <span className={styles.position}>{i + 1}</span>
                      <div className={styles.itemBody}>
                        <div className={styles.itemTitle}>
                          <Badge tone={item.contentType === 'PROMOCION' ? 'accent' : item.contentType === 'ANUNCIO' ? 'info' : 'neutral'}>
                            {TYPE_LABEL[item.contentType]}
                          </Badge>
                          <strong>{item.label || item.title}</strong>
                        </div>
                        {item.extra && <div className={shared.small}>{item.extra}</div>}
                      </div>
                      <div className={styles.itemActions}>
                        <button className={styles.iconBtn} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir">↑</button>
                        <button className={styles.iconBtn} onClick={() => move(i, 1)} disabled={i === draft.items.length - 1} aria-label="Bajar">↓</button>
                        <button
                          className={styles.iconBtn}
                          onClick={() => update(draft.items.map((x, j) => (j === i ? { ...x, active: !x.active } : x)))}
                          aria-label={item.active ? 'Ocultar' : 'Mostrar'}
                          title={item.active ? 'Ocultar' : 'Mostrar'}
                        >
                          {item.active ? '👁' : '🚫'}
                        </button>
                        <button className={styles.iconBtn} onClick={() => update(draft.items.filter((_, j) => j !== i))} aria-label="Quitar">✕</button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card title="Agregar contenido">
              <div className={styles.addGrid}>
                <Field
                  as="select"
                  label="Producto"
                  value=""
                  onChange={(e) => {
                    const p = lists.products.find((x) => x.id === Number(e.target.value));
                    if (p) add({ contentType: 'PRODUCTO', productId: p.id, label: p.name, extra: formatMoney(p.price) });
                  }}
                >
                  <option value="">＋ Agregar producto…</option>
                  {lists.products.filter((p) => !usedProducts.has(p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.category.name} · {p.name} ({formatMoney(p.price)})</option>
                  ))}
                </Field>
                <Field
                  as="select"
                  label="Promoción"
                  value=""
                  onChange={(e) => {
                    const p = lists.promotions.find((x) => x.id === Number(e.target.value));
                    if (p) add({ contentType: 'PROMOCION', promotionId: p.id, label: p.name, extra: p.live ? 'promoción vigente' : 'no vigente: no se mostrará' });
                  }}
                >
                  <option value="">＋ Agregar promoción…</option>
                  {lists.promotions.filter((p) => !usedPromos.has(p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.live ? '' : ' (no vigente)'}</option>
                  ))}
                </Field>
              </div>

              <form
                className={styles.announcementForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (announcement.title.trim().length < 2) return toast.error('Escriba el título del anuncio');
                  add({ contentType: 'ANUNCIO', ...announcement, label: announcement.title, extra: announcement.description });
                  setAnnouncement({ title: '', description: '', imageUrl: '' });
                }}
              >
                <div className={styles.addGrid}>
                  <Field label="Anuncio: título" value={announcement.title} maxLength={120} onChange={(e) => setAnnouncement((a) => ({ ...a, title: e.target.value }))} />
                  <Field label="Texto (opcional)" value={announcement.description} maxLength={300} onChange={(e) => setAnnouncement((a) => ({ ...a, description: e.target.value }))} />
                </div>
                <Field label="Imagen de fondo (URL, opcional)" placeholder="https://…" value={announcement.imageUrl} onChange={(e) => setAnnouncement((a) => ({ ...a, imageUrl: e.target.value }))} />
                <div>
                  <Button type="submit" variant="secondary">＋ Agregar anuncio</Button>
                </div>
              </form>
            </Card>
          </div>

          <Card title="Vista previa (contenido guardado)" className={styles.previewCard}>
            <ScaledPreview key={`${selected}-${previewKey}`} src={`/pantalla/${selected}`} title={`Vista previa pantalla ${selected}`} />
            <p className={shared.small}>Las pantallas se actualizan solas cada 30 segundos. Abra cada una en el navegador del televisor y haga doble clic para pantalla completa.</p>
          </Card>
        </div>
      )}
    </>
  );
}

/** Iframe de 1600×900 (televisor) escalado al ancho disponible. */
function ScaledPreview({ src, title }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / 1600));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={styles.previewFrame}>
      <iframe src={src} title={title} className={styles.iframe} style={{ transform: `scale(${scale})` }} tabIndex={-1} />
    </div>
  );
}

/** Campos que realmente se guardan (para detectar cambios sin guardar). */
function strip({ contentType, productId, promotionId, title, description, imageUrl, active }) {
  return { contentType, productId: productId ?? null, promotionId: promotionId ?? null, title, description, imageUrl, active };
}
