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

/**
 * Permission map for the logged-in manager.
 * Prefers API-provided `user.permissions` (backend matrix); falls back by role.
 */
export function usePermissions() {
  const { user } = useAuth();
  if (user?.permissions && typeof user.permissions === 'object') {
    return user.permissions;
  }
  return permissionsForRole(user?.org_role);
}

export function useCan(resource, action = 'read') {
  const permissions = usePermissions();
  return Boolean(permissions?.[resource]?.[action]);
}
