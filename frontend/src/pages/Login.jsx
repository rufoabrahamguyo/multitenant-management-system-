import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import AuthLayout from '../components/AuthLayout';
import FormAlert from '../components/FormAlert';
import FormField from '../components/FormField';
import { getApiErrorMessage, getApiFieldErrors } from '../utils/apiError';

const ERROR_ID = 'login-error';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { login, logout } = useAuth();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('session') === 'expired') {
      setError('Your session has expired. Please sign in again.');
      searchParams.delete('session');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);
    try {
      const data = await login(username, password, remember);
      if (data.role === 'TENANT') {
        logout();
        const msg = 'Tenants use the Propizy mobile app. Accept your invite link to register.';
        setError(msg);
        toast(msg, 'warning');
        return;
      }
      toast(`Welcome back, ${data.user?.first_name || data.user?.username || 'there'}!`, 'success');
      navigate(data.user?.phone_verified === false ? '/verify-phone' : '/dashboard');
    } catch (err) {
      setFieldErrors(getApiFieldErrors(err));
      setError(getApiErrorMessage(err, 'Invalid username or password. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (name) =>
    `input-field ${fieldErrors[name] ? 'border-red-400 focus:border-red-400 focus:ring-red-500/30' : ''}`;

  return (
    <AuthLayout subtitle="Property Manager Dashboard">
      <form onSubmit={handleSubmit} className="space-y-4" aria-describedby={error ? ERROR_ID : undefined} noValidate>
        {error && <FormAlert type="error" id={ERROR_ID}>{error}</FormAlert>}

        <FormField id="login-username" label="Username" error={fieldErrors.username}>
          {({ id, errorId, invalid }) => (
            <input
              id={id}
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass('username')}
              aria-invalid={invalid}
              aria-describedby={errorId}
              required
            />
          )}
        </FormField>

        <FormField id="login-password" label="Password" error={fieldErrors.password}>
          {({ id, errorId, invalid }) => (
            <input
              id={id}
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass('password')}
              aria-invalid={invalid}
              aria-describedby={errorId}
              required
            />
          )}
        </FormField>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Remember me
          </label>
          <Link to="/forgot-password" className="link-accent hover:underline">
            Forgot password?
          </Link>
        </div>

        <button type="submit" disabled={loading} className="btn-primary btn-md btn-block" aria-busy={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      <p className="text-center text-sm text-slate-500 mt-6">
        New organization?{' '}
        <Link to="/register" className="link-accent hover:underline">
          Register
        </Link>
      </p>
    </AuthLayout>
  );
}
