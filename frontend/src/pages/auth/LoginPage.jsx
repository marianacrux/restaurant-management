import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { getErrorMessage } from '../../services/api.js';
import { Alert, Button, Field } from '../../components/ui/index.jsx';
import { ROLE_HOME } from '../../utils/constants.js';
import styles from './LoginPage.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { login, status, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') return <Navigate to={ROLE_HOME[user.role]} replace />;

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = {};
    if (!EMAIL_RE.test(form.email.trim())) nextErrors.email = 'Ingrese un correo válido';
    if (!form.password) nextErrors.password = 'Ingrese la contraseña';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setServerError('');
    try {
      const u = await login(form.email.trim(), form.password);
      const from = location.state?.from;
      navigate(from && from !== '/login' ? from : ROLE_HOME[u.role], { replace: true });
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.brand}>
          <span className={styles.logo}>R</span>
          <div>
            <h1 className={styles.title}>Gestión de pedidos</h1>
            <p className={styles.subtitle}>Inicie sesión para continuar</p>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {serverError && <Alert>{serverError}</Alert>}
          <Field
            label="Correo electrónico"
            type="email"
            autoComplete="username"
            placeholder="usuario@restaurante.test"
            value={form.email}
            onChange={update('email')}
            error={errors.email}
            autoFocus
          />
          <Field
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={update('password')}
            error={errors.password}
          />
          <Button type="submit" size="lg" block loading={submitting}>
            Ingresar
          </Button>
        </form>
      </section>
    </main>
  );
}
