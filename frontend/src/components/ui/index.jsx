// Kit de componentes base reutilizados por todas las páginas.
import { useEffect, useId } from 'react';
import { Link } from 'react-router-dom';
import styles from './ui.module.css';

const cx = (...classes) => classes.filter(Boolean).join(' ');

export function Button({ variant = 'primary', size, block, loading, children, className, ...props }) {
  return (
    <button
      className={cx(styles.button, styles[variant], size && styles[size], block && styles.block, className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <span className={styles.spinner} style={{ width: 14, height: 14, borderWidth: 2 }} />}
      {children}
    </button>
  );
}

/** Enlace de navegación con apariencia de botón (evita anidar <button> dentro de <a>). */
export function ButtonLink({ to, variant = 'primary', size, children, className, ...props }) {
  return (
    <Link to={to} className={cx(styles.button, styles[variant], size && styles[size], className)} {...props}>
      {children}
    </Link>
  );
}

export function Badge({ tone = 'neutral', children, title }) {
  return (
    <span className={cx(styles.badge, styles[`tone-${tone}`])} title={title}>
      {children}
    </span>
  );
}

export function Card({ title, actions, children, className, bodyClassName }) {
  return (
    <section className={cx(styles.card, className)}>
      {(title || actions) && (
        <header className={styles.cardHeader}>
          {title && <h2 className={styles.cardTitle}>{title}</h2>}
          {actions}
        </header>
      )}
      <div className={cx(styles.cardBody, bodyClassName)}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <h1 className={styles.pageTitle}>{title}</h1>
        {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.pageActions}>{actions}</div>}
    </header>
  );
}

export function StatCard({ label, value, hint }) {
  return (
    <div className={cx(styles.card, styles.stat)}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      {hint && <div className={styles.statHint}>{hint}</div>}
    </div>
  );
}

export function Spinner() {
  return <span className={styles.spinner} role="progressbar" aria-label="Cargando" />;
}

export function Loading({ text = 'Cargando…' }) {
  return (
    <div className={styles.loadingBox}>
      <Spinner /> {text}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyTitle}>{title}</div>
      {children}
    </div>
  );
}

export function Alert({ type = 'error', children, action }) {
  return (
    <div className={cx(styles.alert, styles[`alert-${type}`])} role={type === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {action}
    </div>
  );
}

export function Modal({ title, open, onClose, children, actions }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={title}>
        <h2 className={styles.modalTitle}>{title}</h2>
        {children}
        {actions && <div className={styles.modalActions}>{actions}</div>}
      </div>
    </div>
  );
}

/** Campo de formulario con etiqueta, ayuda y error. `as` = 'input' | 'select' | 'textarea'. */
export function Field({ label, hint, error, as: Tag = 'input', children, ...props }) {
  const id = useId();
  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.fieldLabel} htmlFor={id}>
          {label}
        </label>
      )}
      <Tag id={id} className={cx(styles.input, error && styles.inputInvalid)} aria-invalid={Boolean(error)} {...props}>
        {children}
      </Tag>
      {error ? <span className={styles.fieldError}>{error}</span> : hint && <span className={styles.fieldHint}>{hint}</span>}
    </div>
  );
}
