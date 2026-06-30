import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useFeedback } from '../context/FeedbackContext';
import { useIsOwner } from '../hooks/useIsOwner';
import api from '../api/client';
import { getApiErrorMessage } from '../utils/apiError';
import { unwrapList } from '../utils/apiHelpers';

export default function Payments() {
  const { toast } = useFeedback();
  const isOwner = useIsOwner();
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [alertsError, setAlertsError] = useState(false);
  const [summary, setSummary] = useState({ total_collected: 0, chart_data: [] });
  const [monthFilter, setMonthFilter] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const params = monthFilter ? { month: monthFilter } : {};
    api.get('/payments/', { params }).then(({ data }) => setPayments(unwrapList(data)));
    api.get('/payments/summary/', { params }).then(({ data }) => setSummary(data));
    api.get('/payments/invoices/').then(({ data }) => setInvoices(data));
    if (isOwner) {
      api.get('/payments/integrity-alerts/')
        .then(({ data }) => {
          setAlerts(data);
          setAlertsError(false);
        })
        .catch(() => {
          setAlerts([]);
          setAlertsError(true);
        });
    }
  }, [monthFilter, isOwner]);

  const generateInvoices = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post('/payments/generate-invoices/');
      setInvoices(data);
      const count = Array.isArray(data) ? data.length : 0;
      toast(count ? `Generated ${count} invoice${count === 1 ? '' : 's'} for this month.` : 'Invoices are up to date for this month.', 'success');
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not generate invoices.'), 'error');
    } finally {
      setGenerating(false);
    }
  };

  const statusColor = {
    completed: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    failed: 'bg-red-100 text-red-700',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Payments</h2>
        <input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border p-6">
          <p className="text-sm text-slate-500">Total Rent Collected</p>
          <p className="text-3xl font-bold text-green-600 mt-2">
            KES {Number(summary.total_collected).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-6 lg:col-span-2">
          <p className="text-sm text-slate-500 mb-4">Monthly Collection</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={summary.chart_data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => `KES ${Number(v).toLocaleString()}`} />
              <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {isOwner && alertsError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8 text-sm text-red-700" role="alert">
          Could not load payment integrity alerts.
        </div>
      )}

      {isOwner && !alertsError && alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
          <h3 className="font-semibold text-amber-800 mb-3">Payment Integrity Alerts</h3>
          <div className="space-y-3">
            {alerts.map((a) => (
              <div key={a.payment_id} className="bg-white rounded-lg p-4 border border-amber-100">
                <p className="font-medium text-slate-900">{a.tenant_name} · {a.property_name} Unit {a.unit_number}</p>
                <p className="text-xs text-slate-500 mt-1">KES {Number(a.amount).toLocaleString()} • {a.month_paid} • {a.status}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {a.flags.map((f) => (
                    <span key={f.code} className={`px-2 py-1 rounded text-xs ${f.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {f.message}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-semibold text-slate-900">Invoices</h3>
            <p className="text-sm text-slate-500">Auto-generated monthly rent invoices for tenants</p>
          </div>
          {isOwner && (
            <button
              onClick={generateInvoices}
              disabled={generating}
              className="btn-primary btn-sm disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate This Month\'s Invoices'}
            </button>
          )}
        </div>
        {invoices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {invoices.map((inv) => (
              <div key={inv.id} className="border rounded-lg p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-slate-900">{inv.tenant_name}</p>
                  <p className="text-xs text-slate-500">{inv.property_name} · Unit {inv.unit_number}</p>
                  <p className="text-sm text-slate-600 mt-1">{inv.month} • KES {Number(inv.amount).toLocaleString()}</p>
                </div>
                {inv.invoice_url && (
                  <a href={inv.invoice_url} target="_blank" rel="noreferrer" className="link-accent hover:underline text-sm">
                    PDF
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-4">No invoices yet. Click generate to create this month&apos;s invoices.</p>
        )}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-4">Tenant</th>
              <th className="text-left p-4">Property</th>
              <th className="text-left p-4">Amount</th>
              <th className="text-left p-4">Month</th>
              <th className="text-left p-4">Receipt</th>
              <th className="text-left p-4">Flags</th>
              <th className="text-left p-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-4">{p.tenant_name}</td>
                <td className="p-4">{p.property_name} · {p.unit_number}</td>
                <td className="p-4">KES {Number(p.amount).toLocaleString()}</td>
                <td className="p-4">{p.month_paid}</td>
                <td className="p-4">
                  {p.mpesa_receipt_number || '-'}
                  {p.receipt_url && (
                    <a href={p.receipt_url} target="_blank" rel="noreferrer" className="ml-2 link-accent hover:underline text-xs">PDF</a>
                  )}
                </td>
                <td className="p-4">
                  {p.integrity_flags?.length > 0 ? (
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs">
                      {p.integrity_flags.length} flag{p.integrity_flags.length > 1 ? 's' : ''}
                    </span>
                  ) : '-'}
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${statusColor[p.status]}`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
