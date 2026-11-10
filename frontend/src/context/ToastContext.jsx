import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import styles from './Toast.module.css';

const ToastContext = createContext(null);
let nextId = 1;

// Mensajes breves de confirmación o error ("Pedido #12 creado").
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (message, type = 'success') => {
      const id = nextId++;
      setToasts((list) => [...list, { id, message, type }]);
      setTimeout(() => dismiss(id), type === 'error' ? 6000 : 3500);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({ success: (m) => toast(m, 'success'), error: (m) => toast(m, 'error'), info: (m) => toast(m, 'info') }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.stack} role="status" aria-live="polite">
        {toasts.map((t) => (
          <button key={t.id} className={`${styles.toast} ${styles[t.type]}`} onClick={() => dismiss(t.id)}>
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
