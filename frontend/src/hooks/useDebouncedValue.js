import { useEffect, useState } from 'react';

/** Devuelve `value` cuando deja de cambiar durante `delay` ms (búsquedas mientras se escribe). */
export function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
