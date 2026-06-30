import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useIsOwner } from '../hooks/useIsOwner';
import api from '../api/client';

export default function Reports() {
  const [report, setReport] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [statementUrl, setStatementUrl] = useState(null);
  const isOwner = useIsOwner();

  useEffect(() => {
    api.get('/auth/reports/').then(({ data }) => setReport(data));
  }, []);

  const downloadOwnerStatement = async () => {
    setGenerating(true);
    try {
      const { data } = await api.get('/auth/owner-statement/');
      setStatementUrl(data.statement_url);
      window.open(data.statement_url, '_blank');
    } finally {
      setGenerating(false);
    }
  };

  if (!report) return <p className="text-slate-500">Loading reports...</p>;

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Real-Time Reports</h2>
          <p className="text-sm text-slate-500">Live rental performance for {report.month}</p>
        </div>
        {isOwner && (
          <button
            onClick={downloadOwnerStatement}
            disabled={generating}
            className="btn-primary btn-sm disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Download Owner Statement PDF'}
          </button>
        )}
      </div>

      {statementUrl && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-6 text-sm text-emerald-800">
          Owner statement ready: independent report for diaspora/absentee landlords.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-slate-500">Expected Rent</p>
          <p className="text-2xl font-bold text-slate-900 tracking-tight mt-1">KES {Number(report.expected_rent).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-slate-500">Collected</p>
          <p className="text-2xl font-bold text-green-600 mt-1">KES {Number(report.collected_this_month).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-slate-500">Collection Rate</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{report.collection_rate}%</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-slate-500">Total Arrears</p>
          <p className="text-2xl font-bold text-red-600 mt-1">KES {Number(report.total_arrears).toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">{report.tenants_in_arrears} tenant(s)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border p-6">
          <p className="text-sm font-semibold text-slate-600 mb-4">6-Month Collection Trend</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={report.monthly_trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `KES ${Number(v).toLocaleString()}`} />
              <Bar dataKey="collected" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <p className="text-sm font-semibold text-slate-600 mb-4">Property Breakdown</p>
          <div className="space-y-3">
            {report.property_breakdown.map((p) => (
              <div key={p.name} className="flex justify-between items-center border-b pb-3 last:border-0">
                <div>
                  <p className="font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.occupied}/{p.units} occupied</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-green-600">KES {Number(p.collected).toLocaleString()}</p>
                  <p className="text-xs text-slate-400">of KES {Number(p.expected_rent).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {report.property_breakdown.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-4">No properties yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
