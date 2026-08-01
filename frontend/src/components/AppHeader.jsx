import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { DASHBOARD_META, ROLE_LABELS } from '../constants/orgRoles';

const pageMeta = {
  '/dashboard': null, // filled from role
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
  const roleMeta = DASHBOARD_META[user?.org_role];
  const meta = pathname === '/dashboard' && roleMeta
    ? roleMeta
    : (pageMeta[pathname] || { title: 'Propizy', subtitle: 'Property management dashboard' });

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{meta.title}</h1>
        <p className="text-sm text-slate-500 mt-1">{meta.subtitle}</p>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-900 leading-tight">
              {user?.first_name || user?.username}
            </p>
            <p className="text-[11px] font-semibold text-emerald-600 tracking-wide">
              {ROLE_LABELS[user?.org_role] || user?.org_role || 'Manager'}
            </p>
          </div>
          <div
            className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-semibold tracking-wide shadow-sm"
            aria-hidden="true"
          >
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
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
