import { useEffect, useState } from 'react';
import { useFeedback } from '../context/FeedbackContext';
import api from '../api/client';
import { getApiErrorMessage } from '../utils/apiError';
import { unwrapList } from '../utils/apiHelpers';

export default function Transfers() {
  const { toast, confirm } = useFeedback();
  const [requests, setRequests] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [units, setUnits] = useState([]);
  const [acting, setActing] = useState(null);

  const load = () => {
    api.get('/transfer-requests/').then(({ data }) => setRequests(unwrapList(data)));
    api.get('/unit-availability/').then(({ data }) => setAvailability(data));
    api.get('/units/?status=vacant').catch(() => api.get('/units/')).then(({ data }) => {
      const all = unwrapList(data);
      setUnits(all.filter((u) => u.status === 'vacant'));
    });
  };

  useEffect(() => { load(); }, []);

  const approve = async (id, unitId, tenantName) => {
    if (!unitId) {
      toast('Select a vacant unit to assign before approving.', 'warning');
      return;
    }
    setActing(id);
    try {
      await api.post(`/transfer-requests/${id}/approve/`, { unit_id: Number(unitId) });
      toast(`Transfer approved for ${tenantName}.`, 'success');
      load();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not approve transfer.'), 'error');
    } finally {
      setActing(null);
    }
  };

  const reject = async (id, tenantName) => {
    const ok = await confirm({
      title: 'Reject transfer request?',
      message: `This will reject ${tenantName}'s room change request. They will be notified.`,
      confirmLabel: 'Reject request',
      variant: 'danger',
    });
    if (!ok) return;

    setActing(id);
    try {
      await api.post(`/transfer-requests/${id}/reject/`, { reason: 'Not available at this time' });
      toast('Transfer request rejected.', 'success');
      load();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not reject transfer.'), 'error');
    } finally {
      setActing(null);
    }
  };

  const waitlist = async (id, tenantName) => {
    setActing(id);
    try {
      await api.post(`/transfer-requests/${id}/waitlist/`);
      toast(`${tenantName} moved to waitlist.`, 'success');
      load();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not move to waitlist.'), 'error');
    } finally {
      setActing(null);
    }
  };

  const vacantForCategory = (categoryId) =>
    units.filter((u) => u.category === categoryId && u.status === 'vacant');

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Room Transfer Requests</h2>
      <p className="text-sm text-slate-500 mb-6">
        Review tenant requests to change room category. Approve with a specific vacant unit for full transparency.
      </p>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {availability.map((cat) => (
          <div key={cat.category_id} className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-slate-900">{cat.category_name}</h3>
            <p className="text-xs text-slate-500">{cat.property_name}</p>
            <p className="text-sm mt-2">
              <span className="text-green-600 font-medium">{cat.vacant_count} vacant</span>
              {' · '}
              <span className="text-amber-600">{cat.waitlist_count} waitlisted</span>
            </p>
            {cat.vacant_units?.length > 0 && (
              <ul className="text-xs text-slate-600 mt-2 space-y-1">
                {cat.vacant_units.map((u) => (
                  <li key={u.id}>Unit {u.unit_number} · KES {Number(u.rent_amount).toLocaleString()}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-4">Tenant</th>
              <th className="text-left p-4">From → To</th>
              <th className="text-left p-4">Preferred</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Waitlist #</th>
              <th className="text-left p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-4">
                  <p className="font-medium">{r.tenant_name}</p>
                  <p className="text-xs text-slate-500">{r.property_name}</p>
                </td>
                <td className="p-4">
                  {r.current_category_name || '-'} ({r.current_unit_number})
                  {' → '}
                  <strong>{r.desired_category_name}</strong>
                </td>
                <td className="p-4">{r.preferred_unit_number || '-'}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    r.status === 'completed' ? 'bg-green-100 text-green-700'
                    : r.status === 'waitlisted' ? 'bg-amber-100 text-amber-700'
                    : r.status === 'rejected' ? 'bg-red-100 text-red-700'
                    : 'bg-slate-100 text-slate-700'
                  }`}>{r.status}</span>
                </td>
                <td className="p-4">{r.waitlist_position || '-'}</td>
                <td className="p-4">
                    {['pending', 'waitlisted', 'approved'].includes(r.status) && (
                      <div className="flex flex-col gap-2">
                        <select
                          id={`unit-${r.id}`}
                          className="border rounded px-2 py-1 text-xs"
                          defaultValue={r.preferred_unit || ''}
                        >
                          <option value="">Assign unit...</option>
                          {vacantForCategory(r.desired_category).map((u) => (
                            <option key={u.id} value={u.id}>
                              Unit {u.unit_number} · KES {Number(u.rent_amount).toLocaleString()}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-1 flex-wrap">
                          <button
                            onClick={() => {
                              const sel = document.getElementById(`unit-${r.id}`);
                              approve(r.id, sel?.value, r.tenant_name);
                            }}
                            disabled={acting === r.id}
                            className="btn-success btn-sm"
                          >
                            {acting === r.id ? 'Working...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => waitlist(r.id, r.tenant_name)}
                            disabled={acting === r.id}
                            className="px-2 py-1 bg-amber-500 text-white rounded text-xs disabled:opacity-50"
                          >
                            Waitlist
                          </button>
                          <button
                            onClick={() => reject(r.id, r.tenant_name)}
                            disabled={acting === r.id}
                            className="px-2 py-1 bg-red-500 text-white rounded text-xs disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                    {r.status === 'completed' && r.assigned_unit_number && (
                      <span className="text-green-600 text-xs">→ Unit {r.assigned_unit_number}</span>
                    )}
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">No transfer requests yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
