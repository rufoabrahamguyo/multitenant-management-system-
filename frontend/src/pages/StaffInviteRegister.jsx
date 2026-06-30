import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import AuthLayout from '../components/AuthLayout';
import FormAlert from '../components/FormAlert';
import FormField from '../components/FormField';
import LoadingScreen from '../components/LoadingScreen';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { getApiErrorMessage, getApiFieldErrors } from '../utils/apiError';
import { validatePassword } from '../utils/apiHelpers';

const ERROR_ID = 'staff-register-error';
const PASSWORD_HINT_ID = 'staff-register-password-hint';

const FIELDS = [
  { name: 'username', label: 'Username', type: 'text', autoComplete: 'username', required: true },
  { name: 'first_name', label: 'First Name', type: 'text', autoComplete: 'given-name', required: false },
  { name: 'last_name', label: 'Last Name', type: 'text', autoComplete: 'family-name', required: false },
];

export default function StaffInviteRegister() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, registerStaff } = useAuth();
  const { toast } = useFeedback();
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [form, setForm] = useState({ username: '', password: '', first_name: '', last_name: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const passwordsMatch = !confirmPassword || form.password === confirmPassword;

  useEffect(() => {
    if (user?.role === 'MANAGER') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    let cancelled = false;
    const loadPreview = async () => {
      setLoadingPreview(true);
      setPreviewError('');
      try {
        const { data } = await api.get(`/auth/staff-invite/${token}/`);
        if (!cancelled) setPreview(data);
      } catch {
        if (!cancelled) setPreviewError('This staff invite link is invalid or has expired.');
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    };
    loadPreview();
    return () => { cancelled = true; };
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    if (form.password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const passwordError = validatePassword(form.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    setLoading(true);
    try {
      await registerStaff({ invite_token: token, ...form });
      toast(`Welcome to ${preview?.organization || 'the team'}!`, 'success');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const fields = getApiFieldErrors(err);
      if (Object.keys(fields).length) setFieldErrors(fields);
      setError(getApiErrorMessage(err, 'Registration failed. Please check your details and try again.'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (name) =>
    `input-field ${fieldErrors[name] ? 'border-red-400 focus:border-red-400 focus:ring-red-500/30' : ''}`;

  if (loadingPreview) return <LoadingScreen />;

  if (previewError || !preview?.is_valid) {
    return (
      <AuthLayout title="Invalid Invite" subtitle="This staff invite cannot be used">
        <FormAlert type="error">
          {previewError || 'This invite has expired or already been used.'}
        </FormAlert>
        <p className="text-center text-sm text-slate-500 mt-6">
          Ask your organization owner to send a new invite from the Team page.
        </p>
        <p className="text-center text-sm text-slate-500 mt-4">
          <Link to="/login" className="link-accent hover:underline">Sign in</Link>
          {' · '}
          <Link to="/" className="link-accent hover:underline">Back to home</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Join as Staff"
      subtitle={`You've been invited to ${preview.organization}`}
    >
      <p className="text-center text-sm text-slate-500 -mt-4 mb-6">
        Account email: <span className="font-medium text-slate-700">{preview.email}</span>
      </p>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        aria-describedby={[error && ERROR_ID, !passwordsMatch && PASSWORD_HINT_ID].filter(Boolean).join(' ') || undefined}
        noValidate
      >
        {error && <FormAlert type="error" id={ERROR_ID}>{error}</FormAlert>}

        {FIELDS.map((field) => (
          <FormField
            key={field.name}
            id={`staff-register-${field.name}`}
            label={field.label}
            error={fieldErrors[field.name]}
          >
            {({ id, errorId, invalid }) => (
              <input
                id={id}
                type={field.type}
                name={field.name}
                autoComplete={field.autoComplete}
                value={form[field.name]}
                onChange={handleChange}
                className={inputClass(field.name)}
                required={field.required}
                aria-invalid={invalid}
                aria-describedby={errorId}
              />
            )}
          </FormField>
        ))}

        <FormField id="staff-register-password" label="Password" error={fieldErrors.password}>
          {({ id, errorId, invalid }) => (
            <input
              id={id}
              type="password"
              name="password"
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              className={inputClass('password')}
              required
              aria-invalid={invalid || !passwordsMatch}
              aria-describedby={[errorId, !passwordsMatch && PASSWORD_HINT_ID].filter(Boolean).join(' ') || undefined}
            />
          )}
        </FormField>

        <div>
          <label htmlFor="staff-register-confirm-password" className="label-field">Confirm Password</label>
          <input
            id="staff-register-confirm-password"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`input-field ${!passwordsMatch ? 'border-red-400 focus:border-red-400 focus:ring-red-500/30' : ''}`}
            required
            aria-invalid={!passwordsMatch}
            aria-describedby={!passwordsMatch ? PASSWORD_HINT_ID : undefined}
          />
          {!passwordsMatch && (
            <p id={PASSWORD_HINT_ID} className="text-red-600 text-xs mt-1.5" role="alert">
              Passwords do not match.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !passwordsMatch}
          className="btn-primary btn-md btn-block"
          aria-busy={loading}
        >
          {loading ? 'Creating account…' : 'Create Staff Account'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        Already have an account?{' '}
        <Link to="/login" className="link-accent hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
