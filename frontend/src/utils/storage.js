// localStorage puede fallar (modo privado, almacenamiento bloqueado): nunca debe romper la app.
export const storage = {
  get(key, fallback = null) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* sin almacenamiento: se ignora */
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* sin almacenamiento: se ignora */
    }
  },
};
