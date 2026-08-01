import { useEffect, useState } from 'react';
import { useFeedback } from '../context/FeedbackContext';
import { useIsOwner } from '../hooks/useOrgRole';
import { ROLE_LABELS, STAFF_ASSIGNABLE_ROLES } from '../constants/orgRoles';
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
  const [inviteRole, setInviteRole] = useState('STAFF');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState(null);
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
      const { data } = await api.post('/auth/staff-invites/', { email, role: inviteRole });
      const emailNote = data.email_sent !== false
        ? `Staff invite email sent to ${email}.`
        : `Staff invite created for ${email} (email not configured).`;
      toast(emailNote, 'success');
      setEmail('');
      setInviteRole('STAFF');
      fetchAll();
    } catch (err) {
      setFieldErrors(getApiFieldErrors(err));
      setError(getApiErrorMessage(err, 'Only organization owners can invite staff.'));
    } finally {
      setSending(false);
    }
  };

  const handleRoleChange = async (member, role) => {
    if (role === member.role) return;
    setBusyId(`role-${member.id}`);
    try {
      await api.patch(`/auth/team/${member.id}/`, { role });
      toast(`Updated ${member.first_name || member.username} to ${ROLE_LABELS[role] || role}.`, 'success');
      fetchAll();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not update role.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleSuspendToggle = async (member) => {
    const suspending = member.is_active !== false;
    const ok = await confirm({
      title: suspending ? 'Suspend staff account?' : 'Reactivate staff account?',
      message: suspending
        ? `${member.first_name || member.username} will lose login access until reactivated.`
        : `${member.first_name || member.username} will be able to log in again.`,
      confirmLabel: suspending ? 'Suspend' : 'Reactivate',
      destructive: suspending,
    });
    if (!ok) return;

    setBusyId(`suspend-${member.id}`);
    try {
      const action = suspending ? 'suspend' : 'reactivate';
      await api.post(`/auth/team/${member.id}/${action}/`);
      toast(
        suspending ? 'Staff account suspended.' : 'Staff account reactivated.',
        'success',
      );
      fetchAll();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not update account status.'), 'error');
    } finally {
      setBusyId(null);
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

    setBusyId(`remove-${member.id}`);
    try {
      await api.delete(`/auth/team/${member.id}/`);
      toast(`${member.first_name || member.username} removed from the team.`, 'success');
      fetchAll();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not remove staff member.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const isStaffMember = (m) => m.role !== 'OWNER';

  return (
    <div>
      <p className="text-sm text-slate-500 mb-6">
        {isOwner
          ? 'Invite Front Desk, Maintenance, or general staff with login access. Assign roles and suspend accounts when needed.'
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
          <FormField id="staff-role" label="Role" error={fieldErrors.role} className="min-w-[180px]">
            {({ id }) => (
              <select
                id={id}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="input-field"
              >
                {STAFF_ASSIGNABLE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
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
              {inv.email} · {ROLE_LABELS[inv.role] || inv.role_label || inv.role} · share link:{' '}
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
              <th className="text-left p-4">Status</th>
              {isOwner && <th className="text-left p-4">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className={`border-t ${m.is_active === false ? 'bg-slate-50' : ''}`}>
                <td className="p-4">{m.first_name || m.username}</td>
                <td className="p-4">{m.email}</td>
                <td className="p-4">
                  {isOwner && isStaffMember(m) ? (
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m, e.target.value)}
                      disabled={busyId === `role-${m.id}`}
                      className="input-field text-xs py-1.5 min-h-[36px]"
                    >
                      {STAFF_ASSIGNABLE_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs">
                      {ROLE_LABELS[m.role] || m.role_label || m.role}
                    </span>
                  )}
                </td>
                <td className="p-4">
                  {m.is_active === false ? (
                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">Suspended</span>
                  ) : (
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">Active</span>
                  )}
                </td>
                {isOwner && (
                  <td className="p-4">
                    {isStaffMember(m) ? (
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => handleSuspendToggle(m)}
                          disabled={busyId === `suspend-${m.id}`}
                          className="text-amber-700 hover:text-amber-900 text-sm font-medium disabled:opacity-50 min-h-[44px]"
                        >
                          {busyId === `suspend-${m.id}`
                            ? 'Updating…'
                            : m.is_active === false
                              ? 'Reactivate'
                              : 'Suspend'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(m)}
                          disabled={busyId === `remove-${m.id}`}
                          className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50 min-h-[44px]"
                        >
                          {busyId === `remove-${m.id}` ? 'Removing…' : 'Remove'}
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-slate-50 border rounded-xl p-5 text-sm text-slate-600">
        <p className="font-semibold text-slate-900 mb-2">Role dashboards</p>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>Front Desk:</strong> Tenants, invites, cash collections, transfers, arrears</li>
          <li><strong>Maintenance:</strong> Maintenance ticket queue (unit shown on each ticket)</li>
          <li><strong>Staff:</strong> Broader on-site access (tenants, transfers, maintenance, reports)</li>
          <li><strong>Owner:</strong> Full access including approvals, exports, M-PESA, and team control</li>
        </ul>
      </div>
    </div>
  );
}
