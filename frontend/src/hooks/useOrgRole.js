import { useAuth } from '../context/AuthContext';
import { permissionsForRole } from '../constants/orgRoles';

/** Current organization role (OWNER, FRONT_DESK, MAINTENANCE, STAFF). */
export function useOrgRole() {
  const { user } = useAuth();
  return user?.org_role || null;
}

export function useIsOwner() {
  return useOrgRole() === 'OWNER';
}

/** Permission map for the logged-in manager (defaults by role). */
export function usePermissions() {
  const orgRole = useOrgRole();
  return permissionsForRole(orgRole);
}

export function useCan(resource, action = 'read') {
  const permissions = usePermissions();
  return Boolean(permissions?.[resource]?.[action]);
}
