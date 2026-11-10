import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useResource } from '../../hooks/useResource.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { fetchOrders } from '../../services/orders.service.js';
import { Alert, Button, ButtonLink, Card, EmptyState, Loading, PageHeader } from '../../components/ui/index.jsx';
import OrdersTable from '../../components/OrdersTable.jsx';
import { ORDER_SOURCE, ORDER_STATUS } from '../../utils/constants.js';
import { formatTime } from '../../utils/format.js';
import styles from './OrdersPage.module.css';

const REFRESH_MS = 15_000;
const PAGE_SIZE = 20;

export default function OrdersPage() {
  const { hasRole } = useAuth();
  const [params, setParams] = useSearchParams();
  const statuses = params.get('status')?.split(',').filter(Boolean) ?? [];
  const source = params.get('source') ?? '';
  const page = Number(params.get('page') ?? 1);
  const [searchInput, setSearchInput] = useState(params.get('search') ?? '');
  const search = useDebouncedValue(searchInput.trim());

  // Los filtros viven en la URL: se pueden compartir y el botón "atrás" funciona.
  const updateParams = useCallback(
    (changes) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) {
          if (v === '' || v === null || v === undefined || (Array.isArray(v) && !v.length)) next.delete(k);
          else next.set(k, Array.isArray(v) ? v.join(',') : String(v));
        }
        if (!('page' in changes)) next.delete('page');
        return next;
      });
    },
    [setParams],
  );

  useEffect(() => {
    if (search !== (params.get('search') ?? '')) updateParams({ search });
  }, [search, params, updateParams]);

  const statusKey = statuses.join(',');
  const load = useCallback(
    () => fetchOrders({ status: statusKey ? statusKey.split(',') : [], source, search, page, pageSize: PAGE_SIZE }),
    [statusKey, source, search, page],
  );
  const { data, error, loading, lastUpdated, reload } = useResource(load, { interval: REFRESH_MS, deps: [load] });

  const toggleStatus = (s) =>
    updateParams({ status: statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s] });

  const hasFilters = statuses.length || source || searchInput;

  return (
    <>
      <PageHeader
        title="Pedidos"
        subtitle={lastUpdated ? `Actualizado ${formatTime(lastUpdated.toISOString())} · se refresca cada 15 s` : 'Todos los canales en un solo lugar'}
        actions={
          hasRole('ADMIN', 'CAJERO') && <ButtonLink to="/pedidos/nuevo">＋ Nuevo pedido</ButtonLink>
        }
      />

      <Card bodyClassName={styles.filtersBody}>
        <div className={styles.filters}>
          <input
            className={styles.search}
            type="search"
            placeholder="Buscar por número, cliente o teléfono…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar pedidos"
          />
          <select className={styles.select} value={source} onChange={(e) => updateParams({ source: e.target.value })} aria-label="Canal">
            <option value="">Todos los canales</option>
            {Object.entries(ORDER_SOURCE).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {hasFilters && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearchInput('');
                setParams({});
              }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>
        <div className={styles.chips} role="group" aria-label="Filtrar por estado">
          {Object.entries(ORDER_STATUS).map(([value, { label, tone }]) => (
            <button
              key={value}
              className={`${styles.chip} ${statuses.includes(value) ? styles.chipOn : ''}`}
              data-tone={tone}
              aria-pressed={statuses.includes(value)}
              onClick={() => toggleStatus(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {error && <Alert action={<Button size="sm" variant="secondary" onClick={() => reload()}>Reintentar</Button>}>{error}</Alert>}

      <Card className={styles.results} bodyClassName={styles.tableBody}>
        {loading && !data ? (
          <Loading />
        ) : data?.data.length ? (
          <>
            <OrdersTable orders={data.data} showItems />
            <footer className={styles.pagination}>
              <span>
                {data.pagination.total} pedidos · página {data.pagination.page} de {Math.max(1, data.pagination.totalPages)}
              </span>
              <div className={styles.pageButtons}>
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => updateParams({ page: page - 1 })}>
                  ← Anterior
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= data.pagination.totalPages}
                  onClick={() => updateParams({ page: page + 1 })}
                >
                  Siguiente →
                </Button>
              </div>
            </footer>
          </>
        ) : (
          <EmptyState title="No hay pedidos con estos filtros">
            {hasFilters ? 'Pruebe quitando algún filtro.' : 'Los pedidos de todos los canales aparecerán aquí.'}
          </EmptyState>
        )}
      </Card>
    </>
  );
}
