import axios from 'axios';
import { storage } from '../utils/storage.js';

// Cliente HTTP único. Aquí se añade el token JWT y se detecta la sesión vencida.
export const TOKEN_KEY = 'rm_token';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = storage.get(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = () => {};
/** AuthContext registra aquí qué hacer cuando la API responde 401. */
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLogin = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLogin) onUnauthorized();
    return Promise.reject(error);
  },
);

/** Extrae un mensaje legible de un error de Axios. */
export function getErrorMessage(error) {
  const data = error.response?.data;
  if (data?.details && Array.isArray(data.details) && data.details[0]?.field) {
    return data.details.map((d) => d.message).join('. ');
  }
  if (data?.error) return data.error;
  if (error.code === 'ECONNABORTED') return 'La API tardó demasiado en responder';
  if (!error.response) return 'No se pudo conectar con la API. ¿Está encendido el backend?';
  return 'Ocurrió un error inesperado';
}
