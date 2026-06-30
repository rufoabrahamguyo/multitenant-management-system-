import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from './LoadingScreen';

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
