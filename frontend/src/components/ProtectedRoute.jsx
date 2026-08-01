import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccessPath, permissionsForRole } from '../constants/orgRoles';
import LoadingScreen from './LoadingScreen';

function resolvePermissions(user) {
  if (user?.permissions && typeof user.permissions === 'object') {
    return user.permissions;
  }
  return permissionsForRole(user?.org_role);
}

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || user.role !== 'MANAGER') return <Navigate to="/login" replace />;
  if (user.phone_verified === false) return <Navigate to="/verify-phone" replace />;
  return children;
}

export function VerifyPhoneRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || user.role !== 'MANAGER') return <Navigate to="/login" replace />;
  if (user.phone_verified !== false) return <Navigate to="/dashboard" replace />;
  return children;
}

export function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user?.role === 'MANAGER') {
    return (
      <Navigate
        to={user.phone_verified === false ? '/verify-phone' : '/dashboard'}
        replace
      />
    );
  }
  return children;
}

export function OwnerRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || user.org_role !== 'OWNER') return <Navigate to="/dashboard" replace />;
  return children;
}

/** Restrict a route by org-role permission resource (e.g. governance, reports). */
export function PermissionRoute({ resource, children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  const permissions = resolvePermissions(user);
  if (!permissions?.[resource]?.read) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export function PathPermissionRoute({ path, children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  const permissions = resolvePermissions(user);
  if (!canAccessPath(permissions, path)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export function HomeOrRedirect({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user?.role === 'MANAGER') {
    return (
      <Navigate
        to={user.phone_verified === false ? '/verify-phone' : '/dashboard'}
        replace
      />
    );
  }
  return children;
}
