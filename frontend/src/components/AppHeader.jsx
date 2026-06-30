import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';

const pageMeta = {
  '/dashboard': {
    title: 'Portfolio Overview',
    subtitle: 'Manage your assets and institutional growth',
  },
  '/properties': { title: 'Properties', subtitle: 'Manage buildings and portfolios' },
  '/units': { title: 'Units', subtitle: 'Room categories and unit inventory' },
  '/transfers': { title: 'Transfers', subtitle: 'Tenant room change requests' },
  '/tenants': { title: 'Tenants', subtitle: 'Invite-only tenant onboarding' },
  '/leases': { title: 'Leases', subtitle: 'Active tenancy agreements' },
  '/payments': { title: 'Payments', subtitle: 'Rent collection and invoices' },
  '/reports': { title: 'Reports', subtitle: 'Live rental performance' },
  '/arrears': { title: 'Arrears', subtitle: 'Late payments and reminders' },
  '/governance': { title: 'Governance', subtitle: 'Trust, compliance and accountability' },
  '/maintenance': { title: 'Maintenance', subtitle: 'Tenant service requests' },
  '/activity': { title: 'Activity Log', subtitle: 'Owner audit trail' },
  '/team': { title: 'Team', subtitle: 'Staff access and invites' },
};

function initials(user) {
  const name = user?.first_name || user?.username || 'U';
  return name.slice(0, 2).toUpperCase();
}

export default function AppHeader() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const meta = pageMeta[pathname] || { title: 'Propizy', subtitle: 'Property management dashboard' };

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{meta.title}</h1>
        <p className="text-sm text-slate-500 mt-1">{meta.subtitle}</p>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <div className="hidden md:flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 min-w-[240px] shadow-sm">
          <label htmlFor="app-search" className="sr-only">Search property or unit</label>
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
          </svg>
          <input
            id="app-search"
            type="search"
            placeholder="Search property or unit..."
            className="w-full text-sm text-slate-700 placeholder:text-slate-400 outline-none bg-transparent"
          />
        </div>

        <button
          type="button"
          className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 shadow-sm"
          aria-label="Notifications"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>

        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-900 leading-tight">
              {user?.first_name || user?.username}
            </p>
            <p className="text-[11px] font-semibold text-emerald-600 tracking-wide">
              {user?.org_role || 'MANAGER'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-sm font-semibold text-slate-600">
            {initials(user)}
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              toast('You have been signed out.', 'info', 3000);
              navigate('/login');
            }}
            className="w-8 h-8 rounded-lg text-red-600 hover:bg-red-50 flex items-center justify-center min-w-[44px] min-h-[44px]"
            aria-label="Sign out"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
