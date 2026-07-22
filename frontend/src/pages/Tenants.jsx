import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFeedback } from '../context/FeedbackContext';
import { useCan } from '../hooks/useOrgRole';
import api from '../api/client';
import DeskModal from '../components/DeskModal';
import { DeskStatusBadge } from '../components/DeskCard';
import IdUploadZone from '../components/IdUploadZone';
import FormAlert from '../components/FormAlert';
import FormField from '../components/FormField';
import { getApiErrorMessage, getApiFieldErrors } from '../utils/apiError';
import { unwrapList } from '../utils/apiHelpers';

const EMPTY_PROVISION = {
  email: '',
  phone_number: '',
  unit_id: '',
  username: '',
  first_name: '',
  last_name: '',
  date_of_birth: '',
  nationality: '',
  next_of_kin_name: '',
  next_of_kin_phone: '',
};

export default function Tenants() {
  const { toast, confirm } = useFeedback();
  const navigate = useNavigate();
  const canInvite = useCan('tenants', 'write');
  const canSuspend = useCan('account_suspend', 'write') || canInvite;
  const [tenants, setTenants] = useState([]);
  const [invites, setInvites] = useState([]);
  const [units, setUnits] = useState([]);
  const [mode, setMode] = useState(null); // 'invite' | 'provision' | null
  const [inviteForm, setInviteForm] = useState({ email: '', phone_number: '', unit_id: '' });
  const [provisionForm, setProvisionForm] = useState(EMPTY_PROVISION);
  const [idFront, setIdFront] = useState(null);
  const [idBack, setIdBack] = useState(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [credentials, setCredentials] = useState(null);

  const fetchAll = () => {
    api.get('/tenants/').then(({ data }) => setTenants(unwrapList(data)));
    api.get('/auth/tenant-invites/').then(({ data }) => setInvites(unwrapList(data)));
    api.get('/units/').then(({ data }) => setUnits(unwrapList(data).filter((u) => u.status === 'vacant')));
  };

  useEffect(() => { fetchAll(); }, []);

  const closeModals = () => {
    setMode(null);
    setError('');
    setFieldErrors({});
    setIdFront(null);
    setIdBack(null);
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSending(true);
    const inviteEmail = inviteForm.email;
    try {
      const { data } = await api.post('/auth/tenant-invites/', {
        email: inviteForm.email,
        phone_number: inviteForm.phone_number,
        unit_id: parseInt(inviteForm.unit_id, 10),
      });
      setInviteForm({ email: '', phone_number: '', unit_id: '' });
      closeModals();
      const emailNote = data.email_sent !== false
        ? `Invite email sent to ${inviteEmail}.`
        : `Invite created for ${inviteEmail} (email not configured; copy the link below).`;
      toast(emailNote, 'success');
      fetchAll();
    } catch (err) {
      setFieldErrors(getApiFieldErrors(err));
      setError(getApiErrorMessage(err, 'Failed to send invite.'));
    } finally {
      setSending(false);
    }
  };

  const handleProvision = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSending(true);
    try {
      const payload = {
        ...provisionForm,
        unit_id: parseInt(provisionForm.unit_id, 10),
        date_of_birth: provisionForm.date_of_birth || null,
      };
      const { data } = await api.post('/tenants/provision/', payload);
      const tenantId = data.tenant?.id;

      if (tenantId && (idFront || idBack)) {
        const fd = new FormData();
        if (idFront) fd.append('id_card_front', idFront);
        if (idBack) fd.append('id_card_back', idBack);
        await api.post(`/tenants/${tenantId}/upload-id-card/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      setCredentials(data.credentials);
      setProvisionForm(EMPTY_PROVISION);
      setIdFront(null);
      setIdBack(null);
      closeModals();
      toast(
        idFront || idBack
          ? 'Tenant account set up with ID photos. Share the credentials once.'
          : 'Tenant account set up. Share the credentials once.',
        'success',
      );
      fetchAll();
      if (tenantId) {
        navigate(`/tenants/${tenantId}`, { state: { credentials: data.credentials } });
      }
    } catch (err) {
      setFieldErrors(getApiFieldErrors(err));
      setError(getApiErrorMessage(err, 'Failed to set up tenant account.'));
    } finally {
      setSending(false);
    }
  };

  const copyInvite = (invite) => {
    const link = invite.invite_url || `${window.location.origin}/invite/${invite.token}`;
    navigator.clipboard.writeText(link);
    setCopied(invite.id);
    toast('Invite link copied to clipboard.', 'info', 2500);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSuspendToggle = async (e, tenant) => {
    e.preventDefault();
    e.stopPropagation();
    const suspending = tenant.is_active !== false;
    const name = tenant.first_name || tenant.username;
    const ok = await confirm({
      title: suspending ? 'Suspend tenant account?' : 'Reactivate tenant account?',
      message: suspending
        ? `${name} will lose mobile app login until reactivated.`
        : `${name} will be able to log in again.`,
      confirmLabel: suspending ? 'Suspend' : 'Reactivate',
      destructive: suspending,
    });
    if (!ok) return;

    setBusyId(tenant.id);
    try {
      const action = suspending ? 'suspend' : 'reactivate';
      await api.post(`/tenants/${tenant.id}/${action}/`);
      toast(suspending ? 'Tenant account suspended.' : 'Tenant account reactivated.', 'success');
      fetchAll();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not update tenant account.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="desk-page">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Tenants</h2>
          <p className="text-sm text-slate-500">Invite remotely or set up accounts at the desk</p>
        </div>
        {canInvite && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setError(''); setFieldErrors({}); setMode('invite'); }} className="btn-secondary btn-sm">
              Invite Tenant
            </button>
            <button type="button" onClick={() => { setError(''); setFieldErrors({}); setMode('provision'); }} className="btn-desk">
              + Set up account
            </button>
          </div>
        )}
      </div>

      {credentials && (
        <div className="desk-card border-[#76d2c4]/40 bg-[#e8f8f5] mb-6">
          <div className="flex justify-between gap-3 mb-2">
            <p className="font-semibold text-slate-800">Credentials ready</p>
            <button type="button" className="btn-desk-ghost text-xs" onClick={() => setCredentials(null)}>Dismiss</button>
          </div>
          <p className="text-sm text-slate-600">
            Username <strong>{credentials.username}</strong> · Password <strong>{credentials.temporary_password}</strong>
          </p>
        </div>
      )}

      {invites.filter((i) => i.is_valid).length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-600 mb-3">Pending Invites</h3>
          <div className="space-y-2">
            {invites.filter((i) => i.is_valid).map((inv) => (
              <div key={inv.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex justify-between items-center gap-3">
                <div>
                  <p className="font-medium text-slate-900">{inv.email}</p>
                  <p className="text-sm text-slate-500">{inv.unit_label} • {inv.phone_number}</p>
                </div>
                <button type="button" onClick={() => copyInvite(inv)} className="desk-link">
                  {copied === inv.id ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tenants.map((t) => (
          <div
            key={t.id}
            className={`desk-card hover:border-slate-200 transition-shadow ${
              t.is_active === false ? 'opacity-90 border-red-100' : ''
            }`}
          >
            <div className="flex justify-between items-start gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">{t.first_name || t.username}</h3>
                <p className="text-sm text-slate-500">{t.email} · {t.phone_number}</p>
                {t.property_name && (
                  <p className="text-sm mt-2" style={{ color: 'var(--desk-teal-hover)' }}>
                    {t.property_name} · Unit {t.unit_number}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <DeskStatusBadge active={t.is_active !== false} />
                {t.is_active !== false && t.months_overdue > 0 && (
                  <span className="desk-badge desk-badge-danger">
                    KES {Number(t.balance).toLocaleString()} owed
                  </span>
                )}
                {t.is_active !== false && !(t.months_overdue > 0) && (
                  <span className="desk-badge desk-badge-success">Up to date</span>
                )}
              </div>
            </div>
            {(t.id_card_front_url || t.id_card_back_url) && (
              <p className="mt-3 text-xs font-medium text-slate-400">ID on file</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Link to={`/tenants/${t.id}`} className="desk-link text-xs">
                View profile →
              </Link>
              {canSuspend && (
                <button
                  type="button"
                  onClick={(e) => handleSuspendToggle(e, t)}
                  disabled={busyId === t.id}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-900 disabled:opacity-50"
                >
                  {busyId === t.id
                    ? 'Updating…'
                    : t.is_active === false
                      ? 'Reactivate'
                      : 'Suspend'}
                </button>
              )}
            </div>
          </div>
        ))}
        {tenants.length === 0 && (
          <p className="text-slate-500 col-span-2 text-center py-8">
            No tenants yet. Invite or set up an account to get started.
          </p>
        )}
      </div>

      <DeskModal
        open={mode === 'invite'}
        title="Invite Tenant"
        icon="@"
        onClose={closeModals}
        footer={(
          <>
            <button type="submit" form="invite-tenant-form" disabled={sending} className="btn-desk">
              {sending ? 'Sending…' : 'Send'}
            </button>
            <button type="button" onClick={closeModals} className="btn-desk-ghost">Cancel</button>
          </>
        )}
      >
        <form id="invite-tenant-form" onSubmit={handleInvite} className="space-y-4" noValidate>
          {error && <FormAlert type="error">{error}</FormAlert>}
          <FormField id="invite-email" label="Email" error={fieldErrors.email}>
            {({ id, errorId, invalid }) => (
              <input
                id={id}
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                className="input-field"
                aria-invalid={invalid}
                aria-describedby={errorId}
                required
              />
            )}
          </FormField>
          <FormField id="invite-phone" label="M-PESA phone" error={fieldErrors.phone_number}>
            {({ id, errorId, invalid }) => (
              <input
                id={id}
                type="tel"
                value={inviteForm.phone_number}
                onChange={(e) => setInviteForm({ ...inviteForm, phone_number: e.target.value })}
                className="input-field"
                placeholder="+254712345678"
                aria-invalid={invalid}
                aria-describedby={errorId}
                required
              />
            )}
          </FormField>
          <FormField id="invite-unit" label="Vacant unit" error={fieldErrors.unit_id}>
            {({ id, errorId, invalid }) => (
              <select
                id={id}
                value={inviteForm.unit_id}
                onChange={(e) => setInviteForm({ ...inviteForm, unit_id: e.target.value })}
                className="input-field"
                aria-invalid={invalid}
                aria-describedby={errorId}
                required
              >
                <option value="">Select vacant unit</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.property_name} - Unit {u.unit_number}</option>
                ))}
              </select>
            )}
          </FormField>
        </form>
      </DeskModal>

      <DeskModal
        open={mode === 'provision'}
        title="Set Up Tenant Account"
        icon="+"
        onClose={closeModals}
        footer={(
          <>
            <button type="submit" form="provision-tenant-form" disabled={sending} className="btn-desk">
              {sending ? 'Creating…' : 'Create account'}
            </button>
            <button type="button" onClick={closeModals} className="btn-desk-ghost">Cancel</button>
          </>
        )}
      >
        <form id="provision-tenant-form" onSubmit={handleProvision} className="space-y-4" noValidate>
          {error && <FormAlert type="error">{error}</FormAlert>}
          <p className="text-xs text-slate-400 -mt-2">
            Creates a mobile login with a one-time temporary password for desk onboarding.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="prov-first" label="First Name" error={fieldErrors.first_name}>
              {({ id }) => (
                <input id={id} className="input-field" value={provisionForm.first_name} onChange={(e) => setProvisionForm({ ...provisionForm, first_name: e.target.value })} />
              )}
            </FormField>
            <FormField id="prov-last" label="Last Name" error={fieldErrors.last_name}>
              {({ id }) => (
                <input id={id} className="input-field" value={provisionForm.last_name} onChange={(e) => setProvisionForm({ ...provisionForm, last_name: e.target.value })} />
              )}
            </FormField>
          </div>
          <FormField id="prov-email" label="Email" error={fieldErrors.email}>
            {({ id, errorId, invalid }) => (
              <input id={id} type="email" required className="input-field" value={provisionForm.email} onChange={(e) => setProvisionForm({ ...provisionForm, email: e.target.value })} aria-invalid={invalid} aria-describedby={errorId} />
            )}
          </FormField>
          <FormField id="prov-phone" label="Phone Number" error={fieldErrors.phone_number}>
            {({ id, errorId, invalid }) => (
              <input id={id} type="tel" required placeholder="+254712345678" className="input-field" value={provisionForm.phone_number} onChange={(e) => setProvisionForm({ ...provisionForm, phone_number: e.target.value })} aria-invalid={invalid} aria-describedby={errorId} />
            )}
          </FormField>
          <FormField id="prov-user" label="Username (optional)" error={fieldErrors.username}>
            {({ id }) => (
              <input id={id} className="input-field" value={provisionForm.username} onChange={(e) => setProvisionForm({ ...provisionForm, username: e.target.value })} placeholder="Auto-generated if blank" />
            )}
          </FormField>
          <FormField id="prov-unit" label="Vacant unit" error={fieldErrors.unit_id}>
            {({ id, errorId, invalid }) => (
              <select id={id} required className="input-field" value={provisionForm.unit_id} onChange={(e) => setProvisionForm({ ...provisionForm, unit_id: e.target.value })} aria-invalid={invalid} aria-describedby={errorId}>
                <option value="">Select vacant unit</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.property_name} - Unit {u.unit_number}</option>
                ))}
              </select>
            )}
          </FormField>
          <FormField id="prov-dob" label="Date Of Birth" error={fieldErrors.date_of_birth}>
            {({ id }) => (
              <input id={id} type="date" className="input-field" value={provisionForm.date_of_birth} onChange={(e) => setProvisionForm({ ...provisionForm, date_of_birth: e.target.value })} />
            )}
          </FormField>
          <FormField id="prov-nat" label="Nationality" error={fieldErrors.nationality}>
            {({ id }) => (
              <input id={id} className="input-field" value={provisionForm.nationality} onChange={(e) => setProvisionForm({ ...provisionForm, nationality: e.target.value })} />
            )}
          </FormField>
          <FormField id="prov-kin" label="Next Of Kin Name" error={fieldErrors.next_of_kin_name}>
            {({ id }) => (
              <input id={id} className="input-field" value={provisionForm.next_of_kin_name} onChange={(e) => setProvisionForm({ ...provisionForm, next_of_kin_name: e.target.value })} />
            )}
          </FormField>
          <FormField id="prov-kin-phone" label="Next Of Kin Phone" error={fieldErrors.next_of_kin_phone}>
            {({ id }) => (
              <input id={id} className="input-field" value={provisionForm.next_of_kin_phone} onChange={(e) => setProvisionForm({ ...provisionForm, next_of_kin_phone: e.target.value })} />
            )}
          </FormField>
          <div>
            <p className="label-field">National ID photos</p>
            <p className="text-xs text-slate-400 mb-3">Optional — staff can upload front and back now or later from the profile.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <IdUploadZone
                label="ID Front"
                fileName={idFront?.name}
                onSelect={setIdFront}
              />
              <IdUploadZone
                label="ID Back"
                fileName={idBack?.name}
                onSelect={setIdBack}
              />
            </div>
          </div>
        </form>
      </DeskModal>
    </div>
  );
}
