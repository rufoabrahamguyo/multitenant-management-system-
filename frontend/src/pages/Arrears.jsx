import { useEffect, useState } from 'react';
import { useFeedback } from '../context/FeedbackContext';
import api from '../api/client';
import EmptyState from '../components/EmptyState';
import PageLoader from '../components/PageLoader';
import { getApiErrorMessage } from '../utils/apiError';

export default function Arrears() {
  const { toast } = useFeedback();
  const [arrears, setArrears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reminding, setReminding] = useState(null);

  const fetchArrears = () => {
    setLoading(true);
    setLoadError(false);
    api.get('/payments/arrears/')
      .then(({ data }) => {
        setArrears(data);
      })
      .catch(() => {
        setArrears([]);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchArrears(); }, []);

  const sendReminder = async (leaseId, tenantName) => {
    setReminding(leaseId);
    try {
      const { data } = await api.post('/payments/remind/', { lease_id: leaseId });
      if (data.whatsapp_link) {
        window.open(data.whatsapp_link, '_blank');
      }
      toast(`Reminder sent to ${tenantName}.`, 'success');
      fetchArrears();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not send reminder.'), 'error');
    } finally {
      setReminding(null);
    }
  };

  if (loading) return <PageLoader message="Loading arrears…" />;

  if (loadError) {
    return (
      <EmptyState
        title="Could not load arrears"
        description="Check your connection and try again."
        action={
          <button type="button" onClick={fetchArrears} className="btn-secondary btn-sm">
            Retry
          </button>
        }
      />
    );
  }

  return (
    <div>
      {arrears.length === 0 ? (
        <EmptyState
          title="All tenants are up to date"
          description="No outstanding arrears found."
        />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Tenants with outstanding rent arrears</caption>
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="text-left p-4">Tenant</th>
                <th scope="col" className="text-left p-4">Property</th>
                <th scope="col" className="text-left p-4">Months Overdue</th>
                <th scope="col" className="text-left p-4">Total Owed</th>
                <th scope="col" className="text-left p-4">Last Reminder</th>
                <th scope="col" className="text-left p-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {arrears.map((a) => (
                <tr key={a.lease_id} className="border-t">
                  <td className="p-4">
                    <p className="font-medium text-slate-900">{a.tenant_name}</p>
                    <p className="text-xs text-slate-500">{a.phone_number}</p>
                  </td>
                  <td className="p-4">{a.property_name} · Unit {a.unit_number}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                      {a.months_overdue} month{a.months_overdue > 1 ? 's' : ''}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">{a.arrears_months.join(', ')}</p>
                  </td>
                  <td className="p-4 font-semibold text-red-600">KES {Number(a.total_owed).toLocaleString()}</td>
                  <td className="p-4 text-slate-500">
                    {a.last_reminder_at
                      ? new Date(a.last_reminder_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : 'Never'}
                  </td>
                  <td className="p-4">
                    <button
                      type="button"
                      onClick={() => sendReminder(a.lease_id, a.tenant_name)}
                      disabled={reminding === a.lease_id}
                      className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs hover:bg-amber-600 disabled:opacity-50"
                    >
                      {reminding === a.lease_id ? 'Sending...' : 'SMS + WhatsApp Reminder'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
