import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// El proxy redirige /api al backend en desarrollo: el frontend usa rutas
// relativas (/api/...) y evitamos problemas de CORS y URLs fijas en el código.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
