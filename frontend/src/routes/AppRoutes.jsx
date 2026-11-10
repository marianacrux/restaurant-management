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
import DeliveriesPage from '../pages/deliveries/DeliveriesPage.jsx';
import MyDeliveriesPage from '../pages/deliveries/MyDeliveriesPage.jsx';
import PaymentsPage from '../pages/payments/PaymentsPage.jsx';
import ProductsPage from '../pages/products/ProductsPage.jsx';
import WhatsAppSimulatorPage from '../pages/whatsapp-simulator/WhatsAppSimulatorPage.jsx';
import ScreensAdminPage from '../pages/screens/ScreensAdminPage.jsx';
import DisplayScreenPage from '../pages/screens/DisplayScreenPage.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/estado" element={<SystemStatusPage />} />
      {/* Pantallas digitales: públicas, se abren en el navegador de cada televisor. */}
      <Route path="/pantalla/:number" element={<DisplayScreenPage />} />

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
            <Route path="/domicilios" element={<DeliveriesPage />} />
            <Route path="/pagos" element={<PaymentsPage />} />
            <Route path="/productos" element={<ProductsPage />} />
            <Route path="/whatsapp" element={<WhatsAppSimulatorPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="/pantallas" element={<ScreensAdminPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['ADMIN', 'CAJERO', 'COCINA']} />}>
            <Route path="/pedidos" element={<OrdersPage />} />
            <Route path="/pedidos/:id" element={<OrderDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['DOMICILIARIO', 'ADMIN']} />}>
            <Route path="/entregas" element={<MyDeliveriesPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<RoleHomeRedirect />} />
    </Routes>
  );
}
