import { useEffect, useState } from 'react';
import { useFeedback } from '../context/FeedbackContext';
import { useIsOwner } from '../hooks/useIsOwner';
import api from '../api/client';
import FormAlert from '../components/FormAlert';
import FormField from '../components/FormField';
import { getApiErrorMessage, getApiFieldErrors } from '../utils/apiError';
import { unwrapList } from '../utils/apiHelpers';

export default function Team() {
  const { toast, confirm } = useFeedback();
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const isOwner = useIsOwner();

  const fetchAll = () => {
    api.get('/auth/team/').then(({ data }) => setMembers(unwrapList(data)));
    if (isOwner) {
      api.get('/auth/staff-invites/').then(({ data }) => setInvites(unwrapList(data)));
    }
  };

  useEffect(() => { fetchAll(); }, [isOwner]);

  const handleInvite = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSending(true);
    try {
      const { data } = await api.post('/auth/staff-invites/', { email });
      const emailNote = data.email_sent !== false
        ? `Staff invite email sent to ${email}.`
        : `Staff invite created for ${email} (email not configured).`;
      toast(emailNote, 'success');
      setEmail('');
      fetchAll();
    } catch (err) {
      setFieldErrors(getApiFieldErrors(err));
      setError(getApiErrorMessage(err, 'Only organization owners can invite staff.'));
    } finally {
      setSending(false);
    }
  };

  const handleRemove = async (member) => {
    const ok = await confirm({
      title: 'Remove staff member?',
      message: `${member.first_name || member.username} will lose access to this organization.`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;

    setRemovingId(member.id);
    try {
      await api.delete(`/auth/team/${member.id}/`);
      toast(`${member.first_name || member.username} removed from the team.`, 'success');
      fetchAll();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not remove staff member.'), 'error');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Team</h2>
      <p className="text-sm text-slate-500 mb-6">
        {isOwner
          ? 'Invite caretakers to help with on-site tasks while you retain financial control.'
          : 'View your organization team. Contact the owner for invite or access changes.'}
      </p>

      {isOwner && (
        <form onSubmit={handleInvite} className="card-surface p-6 mb-6 flex flex-wrap gap-4 items-end">
          <FormField id="staff-email" label="Invite staff member" error={fieldErrors.email} className="flex-1 min-w-[200px]">
            {({ id, errorId, invalid }) => (
              <input
                id={id}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@company.com"
                className="input-field"
                aria-invalid={invalid}
                aria-describedby={errorId}
                required
              />
            )}
          </FormField>
          <button type="submit" disabled={sending} className="btn-primary btn-sm disabled:opacity-50 min-h-[44px]">
            {sending ? 'Sending…' : 'Send Invite'}
          </button>
          {error && !fieldErrors.email && (
            <div className="w-full"><FormAlert type="error">{error}</FormAlert></div>
          )}
        </form>
      )}

      {invites.filter((i) => i.is_valid).length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-600 mb-2">Pending Staff Invites</h3>
          {invites.filter((i) => i.is_valid).map((inv) => (
            <div key={inv.id} className="bg-amber-50 border rounded-lg p-3 mb-2 text-sm">
              {inv.email} · share link:{' '}
              <code className="text-xs bg-white px-1 rounded break-all">
                {inv.invite_url || `/staff-invite/${inv.token}`}
              </code>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-4">Name</th>
              <th className="text-left p-4">Email</th>
              <th className="text-left p-4">Role</th>
              {isOwner && <th className="text-left p-4">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-4">{m.first_name || m.username}</td>
                <td className="p-4">{m.email}</td>
                <td className="p-4">
                  <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs">{m.role}</span>
                </td>
                {isOwner && (
                  <td className="p-4">
                    {m.role === 'STAFF' ? (
                      <button
                        type="button"
                        onClick={() => handleRemove(m)}
                        disabled={removingId === m.id}
                        className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50 min-h-[44px]"
                      >
                        {removingId === m.id ? 'Removing…' : 'Remove'}
                      </button>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-slate-50 border rounded-xl p-5 text-sm text-slate-600">
        <p className="font-semibold text-slate-900 mb-2">Staff vs Owner permissions</p>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>Staff:</strong> Invite tenants, manage transfers, send reminders, record cash, update maintenance</li>
          <li><strong>Owner:</strong> All staff access plus cash approval, invoices, exports, M-PESA config, and team management</li>
          <li>All staff actions are logged in the owner-only Activity Log for oversight</li>
        </ul>
      </div>
    </div>
  );
}
