import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useFeedback } from '../context/FeedbackContext';
import { useIsOwner } from '../hooks/useIsOwner';
import api from '../api/client';
import { getApiErrorMessage } from '../utils/apiError';
import { unwrapList } from '../utils/apiHelpers';

function monthKey(value) {
  if (!value) return '';
  return String(value).slice(0, 7);
}

function formatMonthLabel(key) {
  if (!key) return '';
  const [year, month] = key.split('-').map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export default function Payments() {
  const { toast } = useFeedback();
  const isOwner = useIsOwner();
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [alertsError, setAlertsError] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [monthFilter, setMonthFilter] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/payments/').then(({ data }) => setPayments(unwrapList(data))).catch(() => setPayments([])),
      api.get('/payments/summary/').then(({ data }) => setChartData(data.chart_data || [])).catch(() => setChartData([])),
      api.get('/payments/invoices/').then(({ data }) => setInvoices(Array.isArray(data) ? data : unwrapList(data))).catch(() => setInvoices([])),
      isOwner
        ? api.get('/payments/integrity-alerts/')
          .then(({ data }) => {
            setAlerts(data);
            setAlertsError(false);
          })
          .catch(() => {
            setAlerts([]);
            setAlertsError(true);
          })
        : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [isOwner]);

  const monthOptions = useMemo(() => {
    const keys = new Set();
    payments.forEach((p) => {
      const key = monthKey(p.month_paid);
      if (key) keys.add(key);
    });
    chartData.forEach((row) => {
      if (row.month) keys.add(monthKey(row.month));
    });
    return Array.from(keys).sort().reverse();
  }, [payments, chartData]);

  const filteredPayments = useMemo(() => {
    if (!monthFilter) return payments;
    return payments.filter((p) => monthKey(p.month_paid) === monthFilter);
  }, [payments, monthFilter]);

  const filteredChart = useMemo(() => {
    if (!monthFilter) return chartData;
    return chartData.filter((row) => monthKey(row.month) === monthFilter);
  }, [chartData, monthFilter]);

  const totalCollected = useMemo(
    () => filteredChart.reduce((sum, row) => sum + Number(row.total || 0), 0),
    [filteredChart],
  );

  const generateInvoices = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post('/payments/generate-invoices/');
      setInvoices(Array.isArray(data) ? data : unwrapList(data));
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label htmlFor="payments-month-filter" className="block text-sm font-medium text-slate-700 mb-1.5">
            Filter by month
          </label>
          <select
            id="payments-month-filter"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[14rem]"
          >
            <option value="">All months</option>
            {monthOptions.map((key) => (
              <option key={key} value={key}>{formatMonthLabel(key)}</option>
            ))}
          </select>
        </div>
        {monthFilter && (
          <button
            type="button"
            onClick={() => setMonthFilter('')}
            className="btn-secondary btn-sm"
          >
            Clear filter
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border p-6">
          <p className="text-sm text-slate-500">
            {monthFilter ? `Collected · ${formatMonthLabel(monthFilter)}` : 'Total rent collected'}
          </p>
          <p className="text-3xl font-bold text-green-600 mt-2">
            KES {Number(totalCollected).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-6 lg:col-span-2">
          <p className="text-sm text-slate-500 mb-4">Monthly Collection</p>
          {filteredChart.length === 0 ? (
            <p className="text-sm text-slate-500 py-12 text-center">No collections for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={filteredChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => `KES ${Number(v).toLocaleString()}`} />
                <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
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
                <p className="text-xs text-slate-500 mt-1">KES {Number(a.amount).toLocaleString()} • {formatMonthLabel(monthKey(a.month_paid)) || a.month_paid} • {a.status}</p>
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
              type="button"
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
                  <p className="text-sm text-slate-600 mt-1">{formatMonthLabel(monthKey(inv.month)) || inv.month} • KES {Number(inv.amount).toLocaleString()}</p>
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
          <p className="text-sm text-slate-500 text-center py-4">
            {isOwner
              ? 'No invoices yet. Use Generate to create this month\'s invoices.'
              : 'No invoices yet. Ask an owner to generate this month\'s invoices.'}
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
          <h3 className="font-semibold text-slate-900">Payment history</h3>
          <p className="text-xs text-slate-500">
            {monthFilter ? formatMonthLabel(monthFilter) : 'All months'}
            {' · '}
            {filteredPayments.length} payment{filteredPayments.length === 1 ? '' : 's'}
          </p>
        </div>
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
            {filteredPayments.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-4">{p.tenant_name}</td>
                <td className="p-4">{p.property_name} · {p.unit_number}</td>
                <td className="p-4">KES {Number(p.amount).toLocaleString()}</td>
                <td className="p-4">{formatMonthLabel(monthKey(p.month_paid)) || p.month_paid}</td>
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
            {filteredPayments.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  No payments{monthFilter ? ` for ${formatMonthLabel(monthFilter)}` : ''}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
