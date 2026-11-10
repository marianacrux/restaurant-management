import axios from 'axios';

// Cliente HTTP único. Todas las llamadas a la API pasan por aquí, de modo que
// el token JWT (Día 2) y el manejo de errores se configuran en un solo lugar.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
});

/** Extrae un mensaje legible de un error de Axios. */
export function getErrorMessage(error) {
  if (error.response?.data?.error) return error.response.data.error;
  if (error.code === 'ECONNABORTED') return 'La API tardó demasiado en responder';
  if (!error.response) return 'No se pudo conectar con la API';
  return 'Ocurrió un error inesperado';
}
