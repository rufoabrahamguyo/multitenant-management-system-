import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFeedback } from '../context/FeedbackContext';
import api from '../api/client';
import FormAlert from '../components/FormAlert';
import FormField from '../components/FormField';
import { getApiErrorMessage, getApiFieldErrors } from '../utils/apiError';
import { unwrapList } from '../utils/apiHelpers';

export default function Tenants() {
  const { toast } = useFeedback();
  const [tenants, setTenants] = useState([]);
  const [invites, setInvites] = useState([]);
  const [units, setUnits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', phone_number: '', unit_id: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(null);

  const fetchAll = () => {
    api.get('/tenants/').then(({ data }) => setTenants(unwrapList(data)));
    api.get('/auth/tenant-invites/').then(({ data }) => setInvites(unwrapList(data)));
    api.get('/units/').then(({ data }) => setUnits(unwrapList(data).filter((u) => u.status === 'vacant')));
  };

  useEffect(() => { fetchAll(); }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSending(true);
    const inviteEmail = form.email;
    try {
      const { data } = await api.post('/auth/tenant-invites/', {
        email: form.email,
        phone_number: form.phone_number,
        unit_id: parseInt(form.unit_id, 10),
      });
      setForm({ email: '', phone_number: '', unit_id: '' });
      setShowForm(false);
      const emailNote = data.email_sent !== false
        ? `Invite email sent to ${inviteEmail}.`
        : `Invite created for ${inviteEmail} (email not configured — copy the link below).`;
      toast(emailNote, 'success');
      fetchAll();
    } catch (err) {
      setFieldErrors(getApiFieldErrors(err));
      setError(getApiErrorMessage(err, 'Failed to send invite.'));
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Tenants</h2>
          <p className="text-sm text-slate-500">Invite-only onboarding with verified digital lease agreements</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary btn-sm">
          {showForm ? 'Cancel' : '+ Invite Tenant'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleInvite} className="card-surface p-6 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {error && <div className="md:col-span-3"><FormAlert type="error">{error}</FormAlert></div>}
          <FormField id="invite-email" label="Email" error={fieldErrors.email}>
            {({ id, errorId, invalid }) => (
              <input id={id} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" aria-invalid={invalid} aria-describedby={errorId} required />
            )}
          </FormField>
          <FormField id="invite-phone" label="M-PESA phone" error={fieldErrors.phone_number}>
            {({ id, errorId, invalid }) => (
              <input id={id} type="tel" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} className="input-field" placeholder="+254712345678" aria-invalid={invalid} aria-describedby={errorId} required />
            )}
          </FormField>
          <FormField id="invite-unit" label="Vacant unit" error={fieldErrors.unit_id}>
            {({ id, errorId, invalid }) => (
              <select id={id} value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} className="input-field" aria-invalid={invalid} aria-describedby={errorId} required>
                <option value="">Select vacant unit</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.property_name} - Unit {u.unit_number}</option>)}
              </select>
            )}
          </FormField>
          <button type="submit" disabled={sending} className="md:col-span-3 btn-success btn-sm btn-block">
            {sending ? 'Sending invite…' : 'Send Invite'}
          </button>
        </form>
      )}

      {invites.filter((i) => i.is_valid).length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-600 mb-3">Pending Invites</h3>
          <div className="space-y-2">
            {invites.filter((i) => i.is_valid).map((inv) => (
              <div key={inv.id} className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-slate-900">{inv.email}</p>
                  <p className="text-sm text-slate-500">{inv.unit_label} • {inv.phone_number}</p>
                </div>
                <button onClick={() => copyInvite(inv)} className="link-accent hover:underline">
                  {copied === inv.id ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tenants.map((t) => (
          <Link
            key={t.id}
            to={`/tenants/${t.id}`}
            className="bg-white rounded-xl border p-5 block hover:border-slate-300 hover:shadow-sm transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-slate-900">{t.first_name || t.username}</h3>
                <p className="text-sm text-slate-500">{t.email} · {t.phone_number}</p>
                {t.property_name && <p className="text-sm mt-2 text-emerald-600">{t.property_name} · Unit {t.unit_number}</p>}
              </div>
              {t.months_overdue > 0 ? (
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                  KES {Number(t.balance).toLocaleString()} owed
                </span>
              ) : (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Up to date</span>
              )}
            </div>
            {(t.id_card_front_url || t.id_card_back_url) && (
              <p className="mt-3 text-xs font-medium text-slate-500">ID on file</p>
            )}
            {t.payment_history?.length > 0 && (
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs font-semibold text-slate-500 mb-2">Recent Payments</p>
                <div className="space-y-1">
                  {t.payment_history.slice(0, 2).map((p) => (
                    <div key={p.month} className="flex justify-between text-xs text-slate-600">
                      <span>{p.month}</span>
                      <span>KES {Number(p.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <span className="mt-4 inline-block text-xs font-semibold text-emerald-600">View details →</span>
          </Link>
        ))}
        {tenants.length === 0 && <p className="text-slate-500 col-span-2 text-center py-8">No tenants yet. Send an invite to get started.</p>}
      </div>
    </div>
  );
}
