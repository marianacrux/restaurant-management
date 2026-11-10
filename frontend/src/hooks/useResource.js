import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../services/api.js';

/**
 * Carga datos de la API y, opcionalmente, los refresca cada `interval` ms.
 * Hoy usamos polling; en la etapa 2 los módulos podrán cambiar a Socket.IO
 * llamando a `reload()` cuando llegue un evento, sin tocar las páginas.
 *
 * Por defecto pausa el refresco si la pestaña está oculta (ahorra peticiones);
 * la cocina usa `pauseWhenHidden: false` para no perder anuncios en segundo plano.
 *
 * @param {() => Promise<any>} fetcher  Debe ser estable (useCallback) o depender de `deps`.
 */
export function useResource(fetcher, { interval = 0, deps = [], pauseWhenHidden = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const requestId = useRef(0);

  const reload = useCallback(async ({ silent = false } = {}) => {
    const id = ++requestId.current;
    if (!silent) setLoading(true);
    try {
      const result = await fetcherRef.current();
      if (id !== requestId.current) return; // llegó una respuesta más nueva
      setData(result);
      setError('');
      setLastUpdated(new Date());
    } catch (err) {
      if (id === requestId.current) setError(getErrorMessage(err));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!interval) return undefined;
    const timer = setInterval(() => {
      if (!pauseWhenHidden || document.visibilityState === 'visible') reload({ silent: true });
    }, interval);
    const onVisible = () => document.visibilityState === 'visible' && reload({ silent: true });
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [interval, reload, pauseWhenHidden]);

  return { data, error, loading, lastUpdated, reload, setData };
}
