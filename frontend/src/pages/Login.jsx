import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import AuthLayout from '../components/AuthLayout';
import FormAlert from '../components/FormAlert';
import FormField from '../components/FormField';
import { getApiErrorMessage, getApiFieldErrors } from '../utils/apiError';

const ERROR_ID = 'login-error';

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <AuthLayout title="Sign in">
      <form onSubmit={handleSubmit} className="space-y-5" aria-describedby={error ? ERROR_ID : undefined} noValidate>
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
            <div className="auth-password-wrap">
              <input
                id={id}
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass('password')}
                aria-invalid={invalid}
                aria-describedby={errorId}
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          )}
        </FormField>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-500">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="rounded border-slate-300 text-[#76d2c4] focus:ring-[#76d2c4]"
            />
            Remember me
          </label>
          <Link to="/forgot-password" className="link-accent hover:underline">
            Forget Password?
          </Link>
        </div>

        <button type="submit" disabled={loading} className="btn-auth" aria-busy={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="text-center text-sm text-slate-500 mt-8">
        New organization?{' '}
        <Link to="/register" className="link-accent hover:underline">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}
