import { Route, Routes } from 'react-router-dom';
import ProtectedRoute, { RoleHomeRedirect } from './ProtectedRoute.jsx';
import AppLayout from '../layouts/AppLayout.jsx';
import LoginPage from '../pages/auth/LoginPage.jsx';
import SystemStatusPage from '../pages/system/SystemStatusPage.jsx';
import DashboardPage from '../pages/dashboard/DashboardPage.jsx';
import OrdersPage from '../pages/orders/OrdersPage.jsx';
import OrderDetailPage from '../pages/orders/OrderDetailPage.jsx';
import NewOrderPage from '../pages/orders/NewOrderPage.jsx';
import KitchenPage from '../pages/kitchen/KitchenPage.jsx';
import ComingSoonPage from '../pages/system/ComingSoonPage.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/estado" element={<SystemStatusPage />} />

      {/* Cocina: pantalla completa, sin menú lateral (pensada para un monitor fijo). */}
      <Route
        path="/cocina"
        element={
          <ProtectedRoute roles={['ADMIN', 'CAJERO', 'COCINA']}>
            <KitchenPage />
          </ProtectedRoute>
        }
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route element={<ProtectedRoute roles={['ADMIN', 'CAJERO']} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/pedidos/nuevo" element={<NewOrderPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['ADMIN', 'CAJERO', 'COCINA']} />}>
            <Route path="/pedidos" element={<OrdersPage />} />
            <Route path="/pedidos/:id" element={<OrderDetailPage />} />
          </Route>
          <Route
            path="/entregas"
            element={<ComingSoonPage title="Mis entregas" stage="Día 4" description="Aquí el domiciliario verá sus pedidos asignados y confirmará las entregas." />}
          />
        </Route>
      </Route>

      <Route path="*" element={<RoleHomeRedirect />} />
    </Routes>
  );
}
