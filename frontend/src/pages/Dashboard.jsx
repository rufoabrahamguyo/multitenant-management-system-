import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { ACTION_LABELS } from '../constants/activityLabels';
import { useOrgRole } from '../hooks/useOrgRole';
import { formatKes, unwrapList } from '../utils/apiHelpers';
import api from '../api/client';
import SignalIcon, { StatusSignal } from '../components/SignalIcon';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
    </div>
  );
}

function StatCard({ label, value, footer, footerTone = 'neutral', signal }) {
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
        {signal}
      </div>
      {footer && <p className={`text-xs font-medium mt-4 ${footerColors[footerTone]}`}>{footer}</p>}
    </div>
  );
}

/* ---------- Owner ---------- */

function OwnerDashboard() {
  const [stats, setStats] = useState(null);
  const [maintenance, setMaintenance] = useState([]);
  const [activity, setActivity] = useState([]);
  const [activityError, setActivityError] = useState(false);
  const [chartRange, setChartRange] = useState('6M');

  useEffect(() => {
    api.get('/auth/dashboard/').then(({ data }) => setStats(data));
    api.get('/maintenance/').then(({ data }) => setMaintenance(unwrapList(data))).catch(() => setMaintenance([]));
    api.get('/auth/activity/')
      .then(({ data }) => {
        setActivity(unwrapList(data).slice(0, 6));
        setActivityError(false);
      })
      .catch(() => {
        setActivity([]);
        setActivityError(true);
      });
  }, []);

  const chartData = useMemo(() => {
    if (!stats?.monthly_trend) return [];
    const trend = stats.monthly_trend;
    if (chartRange === '1M') return trend.slice(-1);
    return trend;
  }, [stats, chartRange]);

  const highlightIndex = Math.max(chartData.length - 1, 0);
  const openMaintenance = maintenance.filter((m) => m.status !== 'resolved');
  const criticalCount = maintenance.filter((m) => m.status === 'pending').length;

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

  if (!stats) return <Loading />;

  return (
    <div className="pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Portfolio Occupancy"
          value={`${stats.occupancy_rate}%`}
          footer={`${stats.vacant} vacant · ${stats.occupied} occupied`}
          footerTone="success"
          signal={<SignalIcon name="trophy" tone="success" size="lg" label="Occupancy" />}
        />
        <StatCard
          label="Net Income (MTD)"
          value={formatKes(stats.collected_this_month)}
          footer={`${stats.collection_rate}% collection rate this month`}
          footerTone="success"
          signal={<SignalIcon name="cash" tone="success" size="lg" label="Income" />}
        />
        <StatCard
          label="Pending Maintenance"
          value={stats.pending_maintenance}
          footer={criticalCount ? `${criticalCount} critical` : 'No critical alerts'}
          footerTone={criticalCount ? 'danger' : 'neutral'}
          signal={(
            <SignalIcon
              name={criticalCount ? 'flame' : 'alert'}
              tone={criticalCount ? 'danger' : 'warning'}
              size="lg"
              label="Maintenance"
            />
          )}
        />
        <StatCard
          label="Active Leases"
          value={stats.active_leases ?? 0}
          footer={`${stats.overdue_payments} overdue this month`}
          footerTone={stats.overdue_payments ? 'danger' : 'neutral'}
          signal={(
            <SignalIcon
              name={stats.overdue_payments ? 'trend-down' : 'doc'}
              tone={stats.overdue_payments ? 'neutral' : 'brand'}
              size="lg"
              label="Leases"
            />
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
                    chartRange === range ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
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
                  <Cell key={`cell-${index}`} fill={index === highlightIndex ? '#0f172a' : '#dbeafe'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-5">Maintenance Alerts</h2>
          <div className="space-y-4">
            {openMaintenance.slice(0, 3).map((req, idx) => (
              <div key={req.id} className="flex gap-3 items-start">
                <SignalIcon
                  name={req.status === 'pending' ? (idx === 0 ? 'flame' : 'alert') : 'wrench'}
                  tone={req.status === 'pending' ? 'danger' : 'info'}
                  size="sm"
                  label={req.status}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 text-sm">{req.issue_title}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {req.property_name}{req.unit_number ? ` · Unit ${req.unit_number}` : ''}
                  </p>
                </div>
              </div>
            ))}
            {openMaintenance.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">No open maintenance requests.</p>
            )}
          </div>
          <Link to="/maintenance?status=pending" className="mt-6 block w-full text-center py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            View All Requests
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">Recent Activity</h2>
          {activity.length > 0 && (
            <button type="button" onClick={downloadActivityCsv} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
              Download CSV
            </button>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {activity.map((log) => (
            <div key={log.id} className="flex items-center justify-between py-4 gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{ACTION_LABELS[log.action] || log.action}</p>
                <p className="text-xs text-slate-500 mt-1">{log.user} · {log.detail || log.target || '-'}</p>
              </div>
              <span className="text-xs text-slate-400 whitespace-nowrap">{timeAgo(log.created_at)}</span>
            </div>
          ))}
          {activityError && <p className="text-sm text-red-600 text-center py-8" role="alert">Could not load activity log.</p>}
          {!activityError && activity.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">No activity recorded yet.</p>
          )}
        </div>
      </div>

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

/* ---------- Front Desk ---------- */

function FrontDeskDashboard() {
  const [tenants, setTenants] = useState(null);
  const [invites, setInvites] = useState([]);
  const [cash, setCash] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [arrears, setArrears] = useState([]);

  useEffect(() => {
    api.get('/tenants/').then(({ data }) => setTenants(unwrapList(data))).catch(() => setTenants([]));
    api.get('/auth/tenant-invites/').then(({ data }) => setInvites(unwrapList(data).filter((i) => i.is_valid))).catch(() => setInvites([]));
    api.get('/cash-collections/').then(({ data }) => {
      setCash(unwrapList(data).filter((c) => c.status === 'pending').slice(0, 5));
    }).catch(() => setCash([]));
    api.get('/transfer-requests/').then(({ data }) => {
      setTransfers(unwrapList(data).filter((t) => t.status === 'pending' || t.status === 'waitlisted').slice(0, 5));
    }).catch(() => setTransfers([]));
    api.get('/payments/arrears/').then(({ data }) => {
      const list = Array.isArray(data) ? data : (data.results || data.arrears || []);
      setArrears(list.slice(0, 5));
    }).catch(() => setArrears([]));
  }, []);

  if (tenants === null) return <Loading />;

  const overdue = tenants.filter((t) => t.months_overdue > 0).length;

  return (
    <div className="space-y-6 pb-10">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Active tenants"
          value={tenants.length}
          footer={`${overdue} in arrears`}
          footerTone={overdue ? 'danger' : 'success'}
          signal={<SignalIcon name="users" tone={overdue ? 'danger' : 'success'} size="lg" label="Tenants" />}
        />
        <StatCard
          label="Pending invites"
          value={invites.length}
          footer="Awaiting registration"
          signal={<SignalIcon name="user" tone="warning" size="lg" label="Invites" />}
        />
        <StatCard
          label="Cash to approve"
          value={cash.length}
          footer="Waiting on owner"
          footerTone={cash.length ? 'danger' : 'neutral'}
          signal={<SignalIcon name="cash" tone={cash.length ? 'danger' : 'neutral'} size="lg" label="Cash" />}
        />
        <StatCard
          label="Open transfers"
          value={transfers.length}
          footer="Pending / waitlisted"
          signal={<SignalIcon name="transfer" tone="info" size="lg" label="Transfers" />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Pending invites</h2>
            <Link to="/tenants" className="text-sm font-semibold text-emerald-600">Manage</Link>
          </div>
          {invites.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No open invites.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {invites.slice(0, 6).map((inv) => (
                <li key={inv.id} className="py-3 flex justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{inv.email}</p>
                    <p className="text-xs text-slate-500">{inv.unit_label || 'No unit'} · {inv.phone_number}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Cash awaiting approval</h2>
            <Link to="/payments" className="text-sm font-semibold text-emerald-600">Payments</Link>
          </div>
          {cash.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No pending cash collections.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {cash.map((c) => (
                <li key={c.id} className="py-3 flex justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{c.tenant_name || 'Tenant'}</p>
                    <p className="text-xs text-slate-500">{c.unit_number ? `Unit ${c.unit_number}` : ''}</p>
                  </div>
                  <span className="font-semibold text-slate-800">{formatKes(c.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Transfer requests</h2>
            <Link to="/transfers" className="text-sm font-semibold text-emerald-600">Open</Link>
          </div>
          {transfers.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No open transfers.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {transfers.map((t) => (
                <li key={t.id} className="py-3 flex justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{t.tenant_name || t.tenant || 'Tenant'}</p>
                    <p className="text-xs text-slate-500">{t.desired_category_name || t.status}</p>
                  </div>
                  <StatusSignal status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Arrears spotlight</h2>
            <Link to="/arrears" className="text-sm font-semibold text-emerald-600">All arrears</Link>
          </div>
          {arrears.length === 0 && overdue === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No arrears right now.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(arrears.length ? arrears : tenants.filter((t) => t.months_overdue > 0).slice(0, 5)).map((row) => (
                <li key={row.lease_id || row.id || row.username} className="py-3 flex justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{row.tenant_name || row.first_name || row.username}</p>
                    <p className="text-xs text-slate-500">
                      {row.unit_number ? `Unit ${row.unit_number}` : ''}
                      {row.months_overdue ? ` · ${row.months_overdue} mo overdue` : ''}
                    </p>
                  </div>
                  <span className="font-semibold text-red-600">{formatKes(row.total_owed || row.balance || 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Maintenance ---------- */

function MaintenanceDashboard() {
  const [tickets, setTickets] = useState(null);
  const [updating, setUpdating] = useState(null);

  const load = () => {
    api.get('/maintenance/').then(({ data }) => setTickets(unwrapList(data))).catch(() => setTickets([]));
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (id, status) => {
    setUpdating(id);
    try {
      await api.patch(`/maintenance/${id}/`, { status });
      load();
    } finally {
      setUpdating(null);
    }
  };

  if (tickets === null) return <Loading />;

  const open = tickets.filter((t) => t.status !== 'resolved');
  const pending = open.filter((t) => t.status === 'pending');
  const inProgress = open.filter((t) => t.status === 'in-progress');

  return (
    <div className="space-y-6 pb-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Open tickets"
          value={open.length}
          footer="Needs attention"
          footerTone={open.length ? 'danger' : 'success'}
          signal={<SignalIcon name={open.length ? 'flame' : 'trophy'} tone={open.length ? 'danger' : 'success'} size="lg" label="Open tickets" />}
        />
        <StatCard
          label="Pending"
          value={pending.length}
          footer="Not started"
          signal={<SignalIcon name="clock" tone="warning" size="lg" label="Pending" />}
        />
        <StatCard
          label="In progress"
          value={inProgress.length}
          footer="Being worked"
          signal={<SignalIcon name="wrench" tone="info" size="lg" label="In progress" />}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Ticket queue</h2>
          <span className="text-xs text-slate-500">{open.length} open</span>
        </div>
        {open.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-12">No open maintenance tickets.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {open.map((req) => (
              <li key={req.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{req.issue_title}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {req.property_name}{req.unit_number ? ` · Unit ${req.unit_number}` : ''}
                    {req.tenant_name ? ` · ${req.tenant_name}` : ''}
                    {' · '}{timeAgo(req.created_at)}
                  </p>
                  {req.issue_description && (
                    <p className="text-sm text-slate-600 mt-2 line-clamp-2">{req.issue_description}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <StatusSignal status={req.status} />
                  {req.status === 'pending' && (
                    <button
                      type="button"
                      disabled={updating === req.id}
                      onClick={() => setStatus(req.id, 'in-progress')}
                      className="btn-secondary btn-sm disabled:opacity-50"
                    >
                      Start
                    </button>
                  )}
                  {req.status !== 'resolved' && (
                    <button
                      type="button"
                      disabled={updating === req.id}
                      onClick={() => setStatus(req.id, 'resolved')}
                      className="btn-primary btn-sm disabled:opacity-50"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------- General staff / caretaker ---------- */

function StaffDashboard() {
  const [tenants, setTenants] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [cash, setCash] = useState([]);
  const [transfers, setTransfers] = useState([]);

  useEffect(() => {
    api.get('/tenants/').then(({ data }) => setTenants(unwrapList(data))).catch(() => setTenants([]));
    api.get('/maintenance/').then(({ data }) => {
      setTickets(unwrapList(data).filter((t) => t.status !== 'resolved').slice(0, 5));
    }).catch(() => setTickets([]));
    api.get('/cash-collections/').then(({ data }) => {
      setCash(unwrapList(data).filter((c) => c.status === 'pending').slice(0, 5));
    }).catch(() => setCash([]));
    api.get('/transfer-requests/').then(({ data }) => {
      setTransfers(unwrapList(data).filter((t) => t.status === 'pending').slice(0, 5));
    }).catch(() => setTransfers([]));
  }, []);

  if (tenants === null) return <Loading />;

  return (
    <div className="space-y-6 pb-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Tenants"
          value={tenants.length}
          footer="In your portfolio"
          signal={<SignalIcon name="users" tone="success" size="lg" label="Tenants" />}
        />
        <StatCard
          label="Open tickets"
          value={tickets.length}
          footer="Maintenance"
          footerTone={tickets.length ? 'danger' : 'neutral'}
          signal={<SignalIcon name={tickets.length ? 'flame' : 'check'} tone={tickets.length ? 'danger' : 'success'} size="lg" label="Tickets" />}
        />
        <StatCard
          label="Pending cash"
          value={cash.length}
          footer="Awaiting owner approval"
          signal={<SignalIcon name="cash" tone="warning" size="lg" label="Cash" />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Maintenance</h2>
            <Link to="/maintenance?status=all" className="text-sm font-semibold text-emerald-600">All</Link>
          </div>
          {tickets.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No open tickets.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tickets.map((req) => (
                <li key={req.id} className="py-3 text-sm">
                  <p className="font-medium text-slate-900">{req.issue_title}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {req.property_name}{req.unit_number ? ` · ${req.unit_number}` : ''} · {req.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Transfers & cash</h2>
            <Link to="/transfers" className="text-sm font-semibold text-emerald-600">Transfers</Link>
          </div>
          <p className="text-xs font-semibold text-slate-500 mb-2">Pending transfers ({transfers.length})</p>
          {transfers.length === 0 ? (
            <p className="text-sm text-slate-500 mb-4">None</p>
          ) : (
            <ul className="mb-4 divide-y divide-slate-100">
              {transfers.map((t) => (
                <li key={t.id} className="py-2 text-sm font-medium text-slate-800">{t.tenant_name || 'Tenant'} · {t.status}</li>
              ))}
            </ul>
          )}
          <p className="text-xs font-semibold text-slate-500 mb-2">Cash pending approval ({cash.length})</p>
          {cash.length === 0 ? (
            <p className="text-sm text-slate-500">None</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {cash.map((c) => (
                <li key={c.id} className="py-2 flex justify-between text-sm">
                  <span>{c.tenant_name || 'Tenant'}</span>
                  <span className="font-semibold">{formatKes(c.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const orgRole = useOrgRole();

  if (orgRole === 'OWNER') return <OwnerDashboard />;
  if (orgRole === 'FRONT_DESK') return <FrontDeskDashboard />;
  if (orgRole === 'MAINTENANCE') return <MaintenanceDashboard />;
  return <StaffDashboard />;
}
