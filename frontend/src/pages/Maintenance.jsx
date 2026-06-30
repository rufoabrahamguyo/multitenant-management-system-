import { useEffect, useState } from 'react';
import { useFeedback } from '../context/FeedbackContext';
import api from '../api/client';
import { getApiErrorMessage } from '../utils/apiError';
import { unwrapList } from '../utils/apiHelpers';

const statusOptions = ['pending', 'in-progress', 'resolved'];

export default function Maintenance() {
  const { toast } = useFeedback();
  const [requests, setRequests] = useState([]);
  const [updating, setUpdating] = useState(null);

  const fetchRequests = () => {
    api.get('/maintenance/').then(({ data }) => setRequests(unwrapList(data)));
  };

  useEffect(() => { fetchRequests(); }, []);

  const updateStatus = async (id, status) => {
    setUpdating(id);
    try {
      await api.patch(`/maintenance/${id}/`, { status });
      toast(`Request marked as ${status.replace('-', ' ')}.`, 'success');
      fetchRequests();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not update maintenance request.'), 'error');
    } finally {
      setUpdating(null);
    }
  };

  const statusColor = {
    pending: 'bg-yellow-100 text-yellow-700',
    'in-progress': 'bg-slate-100 text-slate-700',
    resolved: 'bg-green-100 text-green-700',
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-6">Maintenance Requests</h2>
      <div className="space-y-4">
        {requests.map((req) => (
          <div key={req.id} className="bg-white rounded-xl border p-5">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-slate-900">{req.issue_title}</h3>
                <p className="text-sm text-slate-500 mt-1">{req.issue_description}</p>
                <p className="text-xs text-slate-400 mt-2">
                  {req.tenant_name} · {req.property_name}, Unit {req.unit_number}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor[req.status]}`}>
                {req.status}
              </span>
            </div>
            {req.status !== 'resolved' && (
              <div className="flex gap-2 mt-4">
                {statusOptions.filter((s) => s !== req.status).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(req.id, s)}
                    disabled={updating === req.id}
                    className="text-xs px-3 py-1.5 border rounded-lg hover:bg-slate-50 capitalize disabled:opacity-50"
                  >
                    {updating === req.id ? 'Updating...' : `Mark ${s.replace('-', ' ')}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {requests.length === 0 && (
          <p className="text-slate-500 text-center py-12">No maintenance requests.</p>
        )}
      </div>
    </div>
  );
}
