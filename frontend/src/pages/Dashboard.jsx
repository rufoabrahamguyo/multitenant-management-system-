import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { ACTION_LABELS } from '../constants/activityLabels';
import { useIsOwner } from '../hooks/useIsOwner';
import { formatKes, unwrapList } from '../utils/apiHelpers';
import api from '../api/client';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function StatCard({ label, value, footer, footerTone = 'neutral', icon, iconBg }) {
  const footerColors = {
    success: 'text-emerald-600',
    danger: 'text-red-600',
    neutral: 'text-slate-500',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      <p className={`text-xs font-medium mt-4 ${footerColors[footerTone]}`}>{footer}</p>
    </div>
  );
}

export default function Dashboard() {
  const isOwner = useIsOwner();
  const [stats, setStats] = useState(null);
  const [maintenance, setMaintenance] = useState(null);
  const [activity, setActivity] = useState([]);
  const [activityError, setActivityError] = useState(false);
  const [chartRange, setChartRange] = useState('6M');

  useEffect(() => {
    api.get('/auth/dashboard/').then(({ data }) => setStats(data));
    api.get('/maintenance/').then(({ data }) => {
      setMaintenance(unwrapList(data));
    }).catch(() => setMaintenance([]));
    if (isOwner) {
      api.get('/auth/activity/')
        .then(({ data }) => {
          setActivity(unwrapList(data).slice(0, 6));
          setActivityError(false);
        })
        .catch(() => {
          setActivity([]);
          setActivityError(true);
        });
    }
  }, [isOwner]);

  const chartData = useMemo(() => {
    if (!stats?.monthly_trend) return [];
    const trend = stats.monthly_trend;
    if (chartRange === '1M') return trend.slice(-1);
    if (chartRange === '6M') return trend;
    return trend;
  }, [stats, chartRange]);

  const highlightIndex = Math.max(chartData.length - 1, 0);

  const openMaintenance = (maintenance ?? []).filter((m) => m.status !== 'resolved');
  const criticalCount = (maintenance ?? []).filter((m) => m.status === 'pending').length;

  const downloadActivityCsv = () => {
    if (!activity.length) return;
    const rows = [['Time', 'User', 'Action', 'Detail'], ...activity.map((log) => [
      log.created_at,
      log.user,
      ACTION_LABELS[log.action] || log.action,
      log.detail || log.target || '',
    ])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'propizy_activity.csv';
    a.click();
  };

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Portfolio Occupancy"
          value={`${stats.occupancy_rate}%`}
          footer={`${stats.vacant} vacant · ${stats.occupied} occupied`}
          footerTone="success"
          iconBg="bg-emerald-50 text-emerald-600"
          icon={(
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 3v18M6 8v13M16 13v8M21 6v15" />
            </svg>
          )}
        />
        <StatCard
          label="Net Income (MTD)"
          value={formatKes(stats.collected_this_month)}
          footer={`${stats.collection_rate}% collection rate this month`}
          footerTone="success"
          iconBg="bg-emerald-50 text-emerald-600"
          icon={(
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          )}
        />
        <StatCard
          label="Pending Maintenance"
          value={stats.pending_maintenance}
          footer={criticalCount ? `${criticalCount} critical alert${criticalCount === 1 ? '' : 's'}` : 'No critical alerts'}
          footerTone={criticalCount ? 'danger' : 'neutral'}
          iconBg="bg-red-50 text-red-500"
          icon={(
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 5c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
            </svg>
          )}
        />
        <StatCard
          label="Active Leases"
          value={stats.active_leases ?? 0}
          footer={`${stats.overdue_payments} overdue payment${stats.overdue_payments === 1 ? '' : 's'} this month`}
          footerTone={stats.overdue_payments ? 'danger' : 'neutral'}
          iconBg="bg-slate-100 text-slate-600"
          icon={(
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900">Financial Performance</h2>
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
              {['1M', '6M', '1Y'].map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setChartRange(range)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    chartRange === range
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barSize={chartRange === '1M' ? 48 : 36}>
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis hide />
              <Bar dataKey="collected" radius={[8, 8, 8, 8]}>
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === highlightIndex ? '#0f172a' : '#dbeafe'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-5">Maintenance Alerts</h2>
          <div className="space-y-4">
            {maintenance === null && (
              <p className="text-sm text-slate-400 text-center py-8">Loading maintenance…</p>
            )}
            {maintenance !== null && openMaintenance.slice(0, 3).map((req, idx) => (
              <div key={req.id} className="flex gap-3">
                <div className={`w-1 rounded-full shrink-0 ${idx === 0 && req.status === 'pending' ? 'bg-red-500' : 'bg-slate-200'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-900 text-sm leading-snug">
                      {req.issue_title}
                      {idx === 0 && req.status === 'pending' && (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                          Critical
                        </span>
                      )}
                    </p>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {timeAgo(req.created_at || new Date().toISOString())}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {req.property_name}{req.unit_number ? ` · Unit ${req.unit_number}` : ''}
                    {req.status === 'pending' ? ' · Urgent attention required' : ` · ${req.status.replace('-', ' ')}`}
                  </p>
                </div>
              </div>
            ))}
            {maintenance !== null && openMaintenance.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">No open maintenance requests.</p>
            )}
          </div>
          <Link
            to="/maintenance"
            className="mt-6 block w-full text-center py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            View All Requests
          </Link>
        </div>
      </div>

      {isOwner && (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">Recent Activity</h2>
          {activity.length > 0 && (
            <button
              type="button"
              onClick={downloadActivityCsv}
              className="text-sm font-semibold text-slate-500 hover:text-slate-800"
            >
              Download CSV
            </button>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {activity.map((log) => (
            <div key={log.id} className="flex items-center justify-between py-4 gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {ACTION_LABELS[log.action] || log.action}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {log.user} · {log.detail || log.target || '-'}
                </p>
              </div>
              <span className="text-xs text-slate-400 whitespace-nowrap">
                {timeAgo(log.created_at)}
              </span>
            </div>
          ))}
          {activityError && (
            <p className="text-sm text-red-600 text-center py-8" role="alert">
              Could not load activity log. Try refreshing the page.
            </p>
          )}
          {!activityError && activity.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">
              No activity recorded yet.
            </p>
          )}
        </div>
      </div>
      )}

      <Link
        to="/properties"
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-slate-900 text-white shadow-xl flex items-center justify-center hover:bg-slate-800 transition-colors"
        aria-label="Add property"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
        </svg>
      </Link>
    </div>
  );
}
