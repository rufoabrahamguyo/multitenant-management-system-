import { useAuth } from '../context/AuthContext';

export function useIsOwner() {
  const { user } = useAuth();
  return user?.org_role === 'OWNER';
}
