/** Organization staff roles and nav visibility for the manager web app. */

export const ORG_ROLES = {
  OWNER: 'OWNER',
  FRONT_DESK: 'FRONT_DESK',
  MAINTENANCE: 'MAINTENANCE',
  STAFF: 'STAFF',
};

export const STAFF_ASSIGNABLE_ROLES = [
  { value: 'FRONT_DESK', label: 'Front Desk' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'STAFF', label: 'Staff (general)' },
];

export const ROLE_LABELS = {
  OWNER: 'Owner',
  FRONT_DESK: 'Front Desk',
  MAINTENANCE: 'Maintenance',
  STAFF: 'Staff',
};

/** Path → required permission resource (matches backend NAV_PERMISSIONS). */
export const NAV_RESOURCE = {
  '/dashboard': 'dashboard',
  '/properties': 'properties',
  '/units': 'units',
  '/transfers': 'transfers',
  '/tenants': 'tenants',
  '/leases': 'leases',
  '/payments': 'payments',
  '/reports': 'reports',
  '/arrears': 'arrears',
  '/governance': 'governance',
  '/maintenance': 'maintenance',
  '/team': 'team',
  '/activity': 'activity_log',
};

/**
 * Nav menus are driven by these permissions.
 * Each role only gets read access to the sections they need.
 */
export const DEFAULT_ROLE_PERMISSIONS = {
  OWNER: Object.fromEntries(
    [
      'dashboard', 'properties', 'units', 'tenants', 'leases', 'payments', 'cash_collections',
      'transfers', 'maintenance', 'team', 'activity_log', 'reports', 'arrears',
      'governance', 'account_suspend',
    ].map((r) => [r, { read: true, write: true }]),
  ),
  FRONT_DESK: {
    dashboard: { read: true },
    tenants: { read: true, write: true },
    units: { read: true },
    payments: { read: true },
    cash_collections: { read: true, write: true },
    transfers: { read: true, write: true },
    arrears: { read: true },
    account_suspend: { read: true, write: true },
  },
  MAINTENANCE: {
    dashboard: { read: true },
    maintenance: { read: true, write: true },
  },
  STAFF: {
    dashboard: { read: true },
    units: { read: true },
    tenants: { read: true, write: true },
    payments: { read: true },
    cash_collections: { read: true, write: true },
    transfers: { read: true, write: true },
    maintenance: { read: true, write: true },
    arrears: { read: true },
    account_suspend: { read: true, write: true },
  },
};

export const DASHBOARD_META = {
  OWNER: {
    title: 'Portfolio Overview',
    subtitle: 'Collections, occupancy, and team activity',
  },
  FRONT_DESK: {
    title: 'Front Desk',
    subtitle: 'Tenants, invites, cash, and transfers',
  },
  MAINTENANCE: {
    title: 'Maintenance Desk',
    subtitle: 'Open tickets and repairs',
  },
  STAFF: {
    title: 'On-site Desk',
    subtitle: 'Tenants, cash, transfers, and maintenance',
  },
};

export function canAccessPath(permissions, path) {
  const resource = NAV_RESOURCE[path];
  if (!resource) return true;
  return Boolean(permissions?.[resource]?.read);
}

export function permissionsForRole(orgRole) {
  return DEFAULT_ROLE_PERMISSIONS[orgRole] || DEFAULT_ROLE_PERMISSIONS.STAFF;
}
