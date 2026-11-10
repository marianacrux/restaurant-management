import { useState } from 'react';
import { createDeliveryPerson, updateDeliveryPerson } from '../services/deliveries.service.js';
import { getErrorMessage } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { TRANSPORT_TYPE } from '../utils/constants.js';
import { Alert, Button, Field, Modal } from './ui/index.jsx';
import shared from '../styles/shared.module.css';

/** Crear o editar un domiciliario. `courier` null = nuevo. */
export default function CourierFormModal({ open, courier, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    name: courier?.name ?? '',
    phone: courier?.phone ?? '',
    transportType: courier?.transportType ?? 'MOTOCICLETA',
  }));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    const phone = form.phone.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '');
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Escriba el nombre';
    if (!/^\d{10}$/.test(phone)) e.phone = 'El teléfono debe tener 10 dígitos';
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    setServerError('');
    try {
      const body = { name: form.name.trim(), phone, transportType: form.transportType };
      const saved = courier ? await updateDeliveryPerson(courier.id, body) : await createDeliveryPerson(body);
      toast.success(courier ? 'Domiciliario actualizado' : `${saved.name} registrado`);
      onSaved();
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={courier ? `Editar · ${courier.name}` : 'Nuevo domiciliario'}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={busy}>Guardar</Button>
        </>
      }
    >
      {serverError && <Alert>{serverError}</Alert>}
      <div className={shared.formGrid}>
        <div className={shared.span2}>
          <Field label="Nombre" value={form.name} onChange={set('name')} error={errors.name} autoFocus maxLength={120} />
        </div>
        <Field label="Teléfono" type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} />
        <Field as="select" label="Transporte" value={form.transportType} onChange={set('transportType')}>
          {Object.entries(TRANSPORT_TYPE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Field>
      </div>
    </Modal>
  );
}
