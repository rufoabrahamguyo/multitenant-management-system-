import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { FeedbackProvider } from './context/FeedbackContext';
import {
  GuestRoute,
  HomeOrRedirect,
  OwnerRoute,
  PathPermissionRoute,
  ProtectedRoute,
  VerifyPhoneRoute,
} from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import LoadingScreen from './components/LoadingScreen';
import HydrationSplash from './components/HydrationSplash';
import Home from './pages/Home';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Register from './pages/Register';
import VerifyPhone from './pages/VerifyPhone';
import StaffInviteRegister from './pages/StaffInviteRegister';
import TenantInviteLanding from './pages/TenantInviteLanding';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Properties = lazy(() => import('./pages/Properties'));
const PropertyDetail = lazy(() => import('./pages/PropertyDetail'));
const Units = lazy(() => import('./pages/Units'));
const Tenants = lazy(() => import('./pages/Tenants'));
const TenantDetail = lazy(() => import('./pages/TenantDetail'));
const Leases = lazy(() => import('./pages/Leases'));
const Payments = lazy(() => import('./pages/Payments'));
const Reports = lazy(() => import('./pages/Reports'));
const Arrears = lazy(() => import('./pages/Arrears'));
const Activity = lazy(() => import('./pages/Activity'));
const Transfers = lazy(() => import('./pages/Transfers'));
const Governance = lazy(() => import('./pages/Governance'));
const Maintenance = lazy(() => import('./pages/Maintenance'));
const Team = lazy(() => import('./pages/Team'));

function LazyPage({ children }) {
  return <Suspense fallback={<LoadingScreen />}>{children}</Suspense>;
}

function Guarded({ path, children }) {
  return (
    <PathPermissionRoute path={path}>
      <LazyPage>{children}</LazyPage>
    </PathPermissionRoute>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeOrRedirect><Home /></HomeOrRedirect>} />
      <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
      <Route path="/reset-password/:token" element={<GuestRoute><ResetPassword /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
      <Route path="/staff-invite/:token" element={<GuestRoute><StaffInviteRegister /></GuestRoute>} />
      <Route path="/invite/:token" element={<GuestRoute><TenantInviteLanding /></GuestRoute>} />
      <Route path="/verify-phone" element={<VerifyPhoneRoute><VerifyPhone /></VerifyPhoneRoute>} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Guarded path="/dashboard"><Dashboard /></Guarded>} />
        <Route path="/properties" element={<Guarded path="/properties"><Properties /></Guarded>} />
        <Route path="/properties/:id" element={<Guarded path="/properties"><PropertyDetail /></Guarded>} />
        <Route path="/units" element={<Guarded path="/units"><Units /></Guarded>} />
        <Route path="/tenants" element={<Guarded path="/tenants"><Tenants /></Guarded>} />
        <Route path="/tenants/:id" element={<Guarded path="/tenants"><TenantDetail /></Guarded>} />
        <Route path="/leases" element={<Guarded path="/leases"><Leases /></Guarded>} />
        <Route path="/payments" element={<Guarded path="/payments"><Payments /></Guarded>} />
        <Route path="/reports" element={<Guarded path="/reports"><Reports /></Guarded>} />
        <Route path="/arrears" element={<Guarded path="/arrears"><Arrears /></Guarded>} />
        <Route path="/activity" element={<LazyPage><OwnerRoute><Activity /></OwnerRoute></LazyPage>} />
        <Route path="/transfers" element={<Guarded path="/transfers"><Transfers /></Guarded>} />
        <Route path="/governance" element={<Guarded path="/governance"><Governance /></Guarded>} />
        <Route path="/maintenance" element={<Guarded path="/maintenance"><Maintenance /></Guarded>} />
        <Route path="/team" element={<Guarded path="/team"><Team /></Guarded>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <FeedbackProvider>
          <AuthProvider>
            <HydrationSplash>
              <AppRoutes />
            </HydrationSplash>
          </AuthProvider>
        </FeedbackProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
