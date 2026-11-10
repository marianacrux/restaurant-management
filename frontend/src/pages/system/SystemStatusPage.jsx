import { useCallback, useEffect, useState } from 'react';
import { fetchHealth } from '../../services/health.service.js';
import { getErrorMessage } from '../../services/api.js';
import styles from './SystemStatusPage.module.css';

// Página de verificación del Día 1: confirma Frontend -> API -> PostgreSQL.
export default function SystemStatusPage() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setHealth(await fetchHealth());
    } catch (err) {
      setHealth(null);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const apiOk = !error && health;
  const dbOk = health?.database?.connected;

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1 className={styles.title}>Estado del sistema</h1>
        <p className={styles.subtitle}>Verificación de conexión Frontend → API → PostgreSQL</p>

        <ul className={styles.list}>
          <StatusRow label="Frontend (React + Vite)" ok detail="En ejecución" />
          <StatusRow
            label="API (Express)"
            loading={loading}
            ok={Boolean(apiOk)}
            detail={apiOk ? 'Respondiendo en /api' : error}
          />
          <StatusRow
            label="Base de datos (PostgreSQL)"
            loading={loading}
            ok={Boolean(dbOk)}
            detail={
              dbOk
                ? `${health.database.name} · ${health.database.version} · ${health.database.latencyMs} ms`
                : health?.database?.error || 'Sin datos'
            }
          />
        </ul>

        <button className={styles.button} onClick={load} disabled={loading}>
          {loading ? 'Comprobando…' : 'Volver a comprobar'}
        </button>
      </section>
    </main>
  );
}

function StatusRow({ label, ok, loading, detail }) {
  const state = loading ? 'loading' : ok ? 'ok' : 'error';
  const text = { loading: 'Comprobando', ok: 'Conectado', error: 'Sin conexión' }[state];
  return (
    <li className={styles.row}>
      <div>
        <div className={styles.label}>{label}</div>
        {!loading && <div className={styles.detail}>{detail}</div>}
      </div>
      <span className={`${styles.badge} ${styles[state]}`}>{text}</span>
    </li>
  );
}
