import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_LABEL } from '../utils/constants.js';
import styles from './AppLayout.module.css';

// Menú filtrado por rol. Los módulos aún no construidos se muestran
// deshabilitados con su etapa, para que el demo sea honesto sobre el alcance.
const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '▦', roles: ['ADMIN', 'CAJERO'] },
  { to: '/pedidos', label: 'Pedidos', icon: '☰', roles: ['ADMIN', 'CAJERO', 'COCINA'], end: true },
  { to: '/pedidos/nuevo', label: 'Nuevo pedido', icon: '＋', roles: ['ADMIN', 'CAJERO'] },
  { to: '/cocina', label: 'Cocina', icon: '♨', roles: ['ADMIN', 'CAJERO', 'COCINA'] },
  { to: '/entregas', label: 'Mis entregas', icon: '➜', roles: ['DOMICILIARIO'] },
  { label: 'Productos', icon: '◫', roles: ['ADMIN'], soon: 'Día 4' },
  { label: 'Domicilios', icon: '➜', roles: ['ADMIN', 'CAJERO'], soon: 'Día 4' },
  { label: 'Pagos', icon: '$', roles: ['ADMIN', 'CAJERO'], soon: 'Día 4' },
  { label: 'WhatsApp', icon: '✉', roles: ['ADMIN', 'CAJERO'], soon: 'Día 5' },
  { label: 'Pantallas', icon: '▭', roles: ['ADMIN'], soon: 'Día 5' },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.logo}>R</span>
          <div>
            <div className={styles.brandName}>Restaurante</div>
            <div className={styles.brandSub}>Gestión de pedidos</div>
          </div>
        </div>

        <nav className={styles.nav} aria-label="Principal">
          {items.map((item) =>
            item.soon ? (
              <span key={item.label} className={`${styles.link} ${styles.disabled}`} title={`Disponible en ${item.soon}`}>
                <span className={styles.icon} aria-hidden="true">{item.icon}</span>
                {item.label}
                <span className={styles.soon}>{item.soon}</span>
              </span>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
              >
                <span className={styles.icon} aria-hidden="true">{item.icon}</span>
                {item.label}
              </NavLink>
            ),
          )}
        </nav>

        <div className={styles.userBox}>
          <div className={styles.avatar} aria-hidden="true">{user.name.charAt(0)}</div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{user.name}</div>
            <div className={styles.userRole}>{ROLE_LABEL[user.role]}</div>
          </div>
          <button className={styles.logout} onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
            ⎋
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
