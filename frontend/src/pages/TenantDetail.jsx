import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useFeedback } from '../context/FeedbackContext';
import { useCan, useIsOwner } from '../hooks/useOrgRole';
import api from '../api/client';
import DeskModal from '../components/DeskModal';
import { DeskCard, DeskField, DeskStatusBadge } from '../components/DeskCard';
import IdUploadZone from '../components/IdUploadZone';
import FormAlert from '../components/FormAlert';
import FormField from '../components/FormField';
import { getApiErrorMessage, getApiFieldErrors } from '../utils/apiError';
import { formatKes } from '../utils/apiHelpers';

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

function IconInfo() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 11v5M12 8h.01" />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconBank() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
    </svg>
  );
}

function IconDoc() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M9 16h6M8 4h5l5 5v11a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path strokeLinecap="round" d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  );
}

function CredentialsBanner({ credentials, onDismiss }) {
  if (!credentials) return null;
  return (
    <div className="desk-card border-[#76d2c4]/40 bg-[#e8f8f5] mb-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-slate-800">Login credentials (show once)</p>
          <p className="text-xs text-slate-500 mt-1">
            Share with the tenant now. They should change this password on first login.
          </p>
        </div>
        <button type="button" onClick={onDismiss} className="btn-desk-ghost text-xs">Dismiss</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DeskField label="Username" value={credentials.username} />
        <DeskField label="Temporary password" value={credentials.temporary_password} />
      </div>
      <button
        type="button"
        className="desk-link mt-3 text-xs"
        onClick={() => {
          navigator.clipboard.writeText(
            `Username: ${credentials.username}\nPassword: ${credentials.temporary_password}`,
          );
        }}
      >
        Copy credentials
      </button>
    </div>
  );
}

export default function TenantDetail() {
  const { id } = useParams();
  const location = useLocation();
  const { toast, confirm } = useFeedback();
  const isOwner = useIsOwner();
  const canWrite = useCan('tenants', 'write');
  const canSuspend = useCan('account_suspend', 'write') || canWrite;
  const [tenant, setTenant] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editSection, setEditSection] = useState(null);
  const [form, setForm] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState(location.state?.credentials || null);

  const fetchTenant = useCallback(() => {
    api.get(`/tenants/${id}/`).then(({ data }) => setTenant(data));
  }, [id]);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  const openEdit = (section) => {
    setError('');
    setFieldErrors({});
    if (section === 'general') {
      setForm({
        first_name: tenant.first_name || '',
        last_name: tenant.last_name || '',
        email: tenant.email || '',
        phone_number: tenant.phone_number || '',
        date_of_birth: tenant.date_of_birth || '',
        nationality: tenant.nationality || '',
        interests: tenant.interests || '',
      });
    } else if (section === 'kin') {
      setForm({
        next_of_kin_name: tenant.next_of_kin_name || '',
        next_of_kin_phone: tenant.next_of_kin_phone || '',
        next_of_kin_email: tenant.next_of_kin_email || '',
      });
    } else if (section === 'refund') {
      setForm({
        refund_account_type: tenant.refund_account_type || '',
        refund_account_name: tenant.refund_account_name || '',
        refund_bank_name: tenant.refund_bank_name || '',
        refund_swift_code: tenant.refund_swift_code || '',
        refund_account_number: tenant.refund_account_number || '',
      });
    }
    setEditSection(section);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setBusy(true);
    try {
      const payload = { ...form };
      if (payload.date_of_birth === '') payload.date_of_birth = null;
      const { data } = await api.patch(`/tenants/${id}/`, payload);
      setTenant(data);
      setEditSection(null);
      toast('Tenant details saved.', 'success');
    } catch (err) {
      setFieldErrors(getApiFieldErrors(err));
      setError(getApiErrorMessage(err, 'Could not save details.'));
    } finally {
      setBusy(false);
    }
  };

  const uploadIdCard = async (file, field) => {
    if (!file) return;
    const fd = new FormData();
    fd.append(field, file);
    setUploading(field);
    try {
      const { data } = await api.post(`/tenants/${id}/upload-id-card/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setTenant(data);
      toast('ID image saved.', 'success');
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not upload ID image.'), 'error');
    } finally {
      setUploading(null);
    }
  };

  const resetCredentials = async () => {
    const ok = await confirm({
      title: 'Issue new temporary password?',
      message: 'The current password will stop working. Share the new password with the tenant once.',
      confirmLabel: 'Generate password',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/tenants/${id}/reset-credentials/`);
      setCredentials(data.credentials);
      setTenant(data.tenant);
      toast('Temporary password generated.', 'success');
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not reset credentials.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSuspendToggle = async () => {
    const suspending = tenant.is_active !== false;
    const ok = await confirm({
      title: suspending ? 'Suspend tenant account?' : 'Reactivate tenant account?',
      message: suspending
        ? `${displayName} will lose mobile app login until reactivated.`
        : `${displayName} will be able to log in again.`,
      confirmLabel: suspending ? 'Suspend' : 'Reactivate',
      destructive: suspending,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const action = suspending ? 'suspend' : 'reactivate';
      const { data } = await api.post(`/tenants/${id}/${action}/`);
      setTenant(data);
      toast(suspending ? 'Tenant account suspended.' : 'Tenant account reactivated.', 'success');
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not update tenant account.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const exportDisputePack = async () => {
    setExporting(true);
    try {
      const { data } = await api.get(`/tenants/${id}/dispute_pack/`);
      window.open(data.dispute_pack_url, '_blank');
      toast('Dispute evidence pack generated.', 'success');
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not generate dispute pack.'), 'error');
    } finally {
      setExporting(false);
    }
  };

  if (!tenant) return <p className="text-slate-500">Loading tenant...</p>;

  const displayName = [tenant.first_name, tenant.last_name].filter(Boolean).join(' ') || tenant.username;
  const modalTitles = {
    general: 'Edit General Information',
    kin: 'Edit Next Of Kin',
    refund: 'Edit Refund Details',
  };

  return (
    <div className="desk-page">
      <Link to="/tenants" className="desk-link text-sm">&larr; Back to tenants</Link>

      <div className="desk-banner mt-4" aria-hidden="true" />

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-slate-400">Tenant profile</p>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{displayName}</h2>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
              ID: {tenant.tenant_id || tenant.id}
            </span>
            <DeskStatusBadge active={tenant.is_active !== false} />
            {tenant.must_change_password && (
              <span className="desk-badge desk-badge-warn">Must change password</span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">{tenant.email} · {tenant.phone_number}</p>
          {tenant.property_name && (
            <p className="text-sm mt-2" style={{ color: 'var(--desk-teal-hover)' }}>
              {tenant.property_name} · Unit {tenant.unit_number}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tenant.months_overdue > 0 ? (
            <span className="desk-badge desk-badge-danger">{formatKes(tenant.balance)} owed</span>
          ) : (
            <span className="desk-badge desk-badge-success">Up to date</span>
          )}
        </div>
      </div>

      <CredentialsBanner credentials={credentials} onDismiss={() => setCredentials(null)} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <DeskCard
          className="xl:col-span-2"
          icon={<IconInfo />}
          title="General Information"
          onEdit={canWrite ? () => openEdit('general') : undefined}
        >
          <div className="flex items-start gap-4 mb-5">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-lg font-bold text-slate-500 shrink-0">
              {(displayName || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{displayName}</p>
              <p className="text-sm text-slate-400">Username · {tenant.username}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            <DeskField label="Date Of Birth" value={formatDate(tenant.date_of_birth)} />
            <DeskField label="Phone Number" value={tenant.phone_number} />
            <DeskField label="Email Address" value={tenant.email} />
            <DeskField label="Nationality" value={tenant.nationality} />
            <DeskField label="Interests And Hobbies" value={tenant.interests} />
          </div>
        </DeskCard>

        <div className="space-y-5">
          <DeskCard
            icon={<IconPeople />}
            title="Next Of Kin"
            onEdit={canWrite ? () => openEdit('kin') : undefined}
          >
            <div className="space-y-4">
              <DeskField label="Name" value={tenant.next_of_kin_name} />
              <DeskField label="Phone Number" value={tenant.next_of_kin_phone} />
              <DeskField label="Email Address" value={tenant.next_of_kin_email} />
            </div>
          </DeskCard>

          <DeskCard
            icon={<IconBank />}
            title="Refund Details"
            onEdit={canWrite ? () => openEdit('refund') : undefined}
          >
            <div className="space-y-4">
              <DeskField label="Account Type" value={tenant.refund_account_type} />
              <DeskField label="Account Name" value={tenant.refund_account_name} />
              <DeskField label="Bank Name" value={tenant.refund_bank_name} />
              <DeskField label="Swift Code" value={tenant.refund_swift_code} />
              <DeskField label="Account Number" value={tenant.refund_account_number} />
            </div>
          </DeskCard>
        </div>

        <DeskCard className="xl:col-span-2" icon={<IconDoc />} title="Important Documents">
          <p className="text-sm text-slate-400 mb-4 -mt-2">
            Staff can photograph and upload the tenant&apos;s national ID (front and back) for verification.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <IdUploadZone
              label="National ID · Front"
              imageUrl={tenant.id_card_front_url}
              uploading={uploading === 'id_card_front'}
              disabled={!canWrite}
              onSelect={(file) => uploadIdCard(file, 'id_card_front')}
            />
            <IdUploadZone
              label="National ID · Back"
              imageUrl={tenant.id_card_back_url}
              uploading={uploading === 'id_card_back'}
              disabled={!canWrite}
              onSelect={(file) => uploadIdCard(file, 'id_card_back')}
            />
          </div>
        </DeskCard>

        <DeskCard icon={<IconLock />} title="Account">
          <div className="space-y-4">
            <DeskField label="Username" value={tenant.username} />
            <div>
              <p className="desk-label">Status</p>
              <DeskStatusBadge active={tenant.is_active !== false} />
            </div>
            {canWrite && (
              <button type="button" disabled={busy} onClick={resetCredentials} className="btn-desk w-full">
                {busy ? 'Working…' : 'Issue temporary password'}
              </button>
            )}
            {canSuspend && (
              <button
                type="button"
                disabled={busy}
                onClick={handleSuspendToggle}
                className={`w-full rounded-md px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  tenant.is_active === false
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                {tenant.is_active === false ? 'Reactivate account' : 'Suspend account'}
              </button>
            )}
          </div>
        </DeskCard>
      </div>

      {tenant.payment_history?.length > 0 && (
        <DeskCard className="mt-5" title="Recent payments">
          <div className="space-y-2">
            {tenant.payment_history.map((p) => (
              <div key={p.month} className="flex justify-between text-sm text-slate-600 border-b border-slate-50 pb-2 last:border-0">
                <span>{p.month}</span>
                <span className="font-semibold text-slate-800">{formatKes(p.amount)} · {p.receipt}</span>
              </div>
            ))}
          </div>
        </DeskCard>
      )}

      {isOwner && (
        <button
          type="button"
          onClick={exportDisputePack}
          disabled={exporting}
          className="mt-6 desk-link text-sm disabled:opacity-50"
        >
          {exporting ? 'Generating...' : 'Export dispute evidence pack'}
        </button>
      )}

      <DeskModal
        open={Boolean(editSection)}
        title={modalTitles[editSection] || 'Edit'}
        icon={<IconInfo />}
        onClose={() => setEditSection(null)}
        footer={(
          <>
            <button type="submit" form="tenant-edit-form" disabled={busy} className="btn-desk">
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditSection(null)} className="btn-desk-ghost">
              Cancel
            </button>
          </>
        )}
      >
        <form id="tenant-edit-form" onSubmit={saveProfile} className="space-y-4" noValidate>
          {error && <FormAlert type="error">{error}</FormAlert>}

          {editSection === 'general' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField id="edit-first" label="First Name" error={fieldErrors.first_name}>
                  {({ id }) => (
                    <input id={id} className="input-field" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                  )}
                </FormField>
                <FormField id="edit-last" label="Last Name" error={fieldErrors.last_name}>
                  {({ id }) => (
                    <input id={id} className="input-field" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                  )}
                </FormField>
              </div>
              <FormField id="edit-email" label="Email" error={fieldErrors.email}>
                {({ id }) => (
                  <input id={id} type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                )}
              </FormField>
              <FormField id="edit-phone" label="Phone Number" error={fieldErrors.phone_number}>
                {({ id }) => (
                  <input id={id} className="input-field" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
                )}
              </FormField>
              <FormField id="edit-dob" label="Date Of Birth" error={fieldErrors.date_of_birth}>
                {({ id }) => (
                  <input id={id} type="date" className="input-field" value={form.date_of_birth || ''} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
                )}
              </FormField>
              <FormField id="edit-nat" label="Nationality" error={fieldErrors.nationality}>
                {({ id }) => (
                  <input id={id} className="input-field" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
                )}
              </FormField>
              <FormField id="edit-interests" label="Interests And Hobbies" error={fieldErrors.interests}>
                {({ id }) => (
                  <textarea id={id} rows={3} className="input-field" value={form.interests} onChange={(e) => setForm({ ...form, interests: e.target.value })} />
                )}
              </FormField>
            </>
          )}

          {editSection === 'kin' && (
            <>
              <FormField id="edit-kin-name" label="Name" error={fieldErrors.next_of_kin_name}>
                {({ id }) => (
                  <input id={id} className="input-field" value={form.next_of_kin_name} onChange={(e) => setForm({ ...form, next_of_kin_name: e.target.value })} />
                )}
              </FormField>
              <FormField id="edit-kin-phone" label="Phone Number" error={fieldErrors.next_of_kin_phone}>
                {({ id }) => (
                  <input id={id} className="input-field" value={form.next_of_kin_phone} onChange={(e) => setForm({ ...form, next_of_kin_phone: e.target.value })} />
                )}
              </FormField>
              <FormField id="edit-kin-email" label="Email Address" error={fieldErrors.next_of_kin_email}>
                {({ id }) => (
                  <input id={id} type="email" className="input-field" value={form.next_of_kin_email} onChange={(e) => setForm({ ...form, next_of_kin_email: e.target.value })} />
                )}
              </FormField>
            </>
          )}

          {editSection === 'refund' && (
            <>
              <FormField id="edit-acc-type" label="Account Type" error={fieldErrors.refund_account_type}>
                {({ id }) => (
                  <input id={id} className="input-field" value={form.refund_account_type} onChange={(e) => setForm({ ...form, refund_account_type: e.target.value })} />
                )}
              </FormField>
              <FormField id="edit-acc-name" label="Account Name" error={fieldErrors.refund_account_name}>
                {({ id }) => (
                  <input id={id} className="input-field" value={form.refund_account_name} onChange={(e) => setForm({ ...form, refund_account_name: e.target.value })} />
                )}
              </FormField>
              <FormField id="edit-bank" label="Bank Name" error={fieldErrors.refund_bank_name}>
                {({ id }) => (
                  <input id={id} className="input-field" value={form.refund_bank_name} onChange={(e) => setForm({ ...form, refund_bank_name: e.target.value })} />
                )}
              </FormField>
              <FormField id="edit-swift" label="Swift Code" error={fieldErrors.refund_swift_code}>
                {({ id }) => (
                  <input id={id} className="input-field" value={form.refund_swift_code} onChange={(e) => setForm({ ...form, refund_swift_code: e.target.value })} />
                )}
              </FormField>
              <FormField id="edit-acc-num" label="Account Number" error={fieldErrors.refund_account_number}>
                {({ id }) => (
                  <input id={id} className="input-field" value={form.refund_account_number} onChange={(e) => setForm({ ...form, refund_account_number: e.target.value })} />
                )}
              </FormField>
            </>
          )}
        </form>
      </DeskModal>
    </div>
  );
}
