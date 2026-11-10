import { Navigate, Route, Routes } from 'react-router-dom';
import SystemStatusPage from '../pages/system/SystemStatusPage.jsx';

// Día 1: solo la página de estado del sistema.
// Día 2+: login, rutas protegidas por rol y módulos.
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/estado" element={<SystemStatusPage />} />
      <Route path="*" element={<Navigate to="/estado" replace />} />
    </Routes>
  );
}
