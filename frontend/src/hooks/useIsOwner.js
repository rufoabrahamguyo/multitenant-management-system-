import { useAuth } from '../context/AuthContext';

/** @deprecated Prefer useOrgRole / useIsOwner from useOrgRole.js */
export function useIsOwner() {
  const { user } = useAuth();
  return user?.org_role === 'OWNER';
}
