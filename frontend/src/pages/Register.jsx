import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import AuthLayout from '../components/AuthLayout';
import FormAlert from '../components/FormAlert';
import FormField from '../components/FormField';
import { getApiErrorMessage, getApiFieldErrors } from '../utils/apiError';
import { isValidKenyaPhone, validatePassword } from '../utils/apiHelpers';

const ERROR_ID = 'register-error';
const PASSWORD_HINT_ID = 'register-password-hint';

const FIELDS = [
  { name: 'username', label: 'Username', type: 'text', autoComplete: 'username', required: true },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', required: true },
  { name: 'first_name', label: 'First Name', type: 'text', autoComplete: 'given-name', required: false },
  { name: 'last_name', label: 'Last Name', type: 'text', autoComplete: 'family-name', required: false },
];

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

export default function Register() {
  const [form, setForm] = useState({
    username: '', email: '', password: '', first_name: '', last_name: '', organization_name: '', phone_number: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { toast } = useFeedback();
  const navigate = useNavigate();

  const passwordsMatch = !confirmPassword || form.password === confirmPassword;

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
    if (!isValidKenyaPhone(form.phone_number)) {
      setFieldErrors({ phone_number: 'Enter a valid Kenya phone number (e.g. +254712345678).' });
      return;
    }
    setLoading(true);
    try {
      await register(form);
      toast('Organization created! Welcome to Propizy.', 'success');
      navigate('/dashboard');
    } catch (err) {
      const fields = getApiFieldErrors(err);
      if (Object.keys(fields).length) {
        setFieldErrors(fields);
      }
      setError(getApiErrorMessage(err, 'Registration failed. Please check your details and try again.'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (name) =>
    `input-field ${fieldErrors[name] ? 'border-red-400 focus:border-red-400 focus:ring-red-500/30' : ''}`;

  return (
    <AuthLayout title="Sign up" subtitle="Create your organization account">
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        aria-describedby={[error && ERROR_ID, !passwordsMatch && PASSWORD_HINT_ID].filter(Boolean).join(' ') || undefined}
        noValidate
      >
        {error && <FormAlert type="error" id={ERROR_ID}>{error}</FormAlert>}

        <FormField id="register-organization" label="Organization Name" error={fieldErrors.organization_name}>
          {({ id, errorId, invalid }) => (
            <input
              id={id}
              name="organization_name"
              value={form.organization_name}
              onChange={handleChange}
              className={inputClass('organization_name')}
              autoComplete="organization"
              required
              placeholder="Kamau Properties Ltd"
              aria-invalid={invalid}
              aria-describedby={errorId}
            />
          )}
        </FormField>

        <FormField id="register-phone" label="M-PESA Phone" error={fieldErrors.phone_number}>
          {({ id, errorId, invalid }) => (
            <input
              id={id}
              name="phone_number"
              type="tel"
              value={form.phone_number}
              onChange={handleChange}
              className={inputClass('phone_number')}
              autoComplete="tel"
              required
              placeholder="+254712345678"
              aria-invalid={invalid}
              aria-describedby={errorId}
            />
          )}
        </FormField>

        {FIELDS.map((field) => (
          <FormField
            key={field.name}
            id={`register-${field.name}`}
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

        <FormField id="register-password" label="Password" error={fieldErrors.password}>
          {({ id, errorId, invalid }) => (
            <div className="auth-password-wrap">
              <input
                id={id}
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                className={inputClass('password')}
                required
                aria-invalid={invalid || !passwordsMatch}
                aria-describedby={[errorId, !passwordsMatch && PASSWORD_HINT_ID].filter(Boolean).join(' ') || undefined}
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

        <div>
          <label htmlFor="register-confirm-password" className="label-field">Confirm Password</label>
          <div className="auth-password-wrap">
            <input
              id="register-confirm-password"
              type={showConfirm ? 'text' : 'password'}
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`input-field ${!passwordsMatch ? 'border-red-400 focus:border-red-400 focus:ring-red-500/30' : ''}`}
              required
              aria-invalid={!passwordsMatch}
              aria-describedby={!passwordsMatch ? PASSWORD_HINT_ID : undefined}
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              <EyeIcon open={showConfirm} />
            </button>
          </div>
          {!passwordsMatch && (
            <p id={PASSWORD_HINT_ID} className="text-red-600 text-xs mt-1.5" role="alert">
              Passwords do not match.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !passwordsMatch}
          className="btn-auth mt-2"
          aria-busy={loading}
        >
          {loading ? 'Creating…' : 'Sign up'}
        </button>
      </form>
      <p className="text-center text-sm text-slate-500 mt-8">
        Already have an account?{' '}
        <Link to="/login" className="link-accent hover:underline">Sign in</Link>
      </p>
      <p className="text-center text-xs text-slate-400 mt-3">
        Tenants join via invite link in the mobile app
      </p>
    </AuthLayout>
  );
}
