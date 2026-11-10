import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Loading } from '../components/ui/index.jsx';
import { ROLE_HOME } from '../utils/constants.js';

/**
 * Exige sesión y, si se indica, uno de los roles. La seguridad real está en
 * el backend; esto solo evita mostrar pantallas que el usuario no puede usar.
 */
export default function ProtectedRoute({ roles, children }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <Loading text="Verificando sesión…" />;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role] ?? '/login'} replace />;

  return children ?? <Outlet />;
}

export function RoleHomeRedirect() {
  const { user, status } = useAuth();
  if (status === 'loading') return <Loading text="Verificando sesión…" />;
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />;
}
