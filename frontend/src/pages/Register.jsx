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

export default function Register() {
  const [form, setForm] = useState({
    username: '', email: '', password: '', first_name: '', last_name: '', organization_name: '', phone_number: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
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
      toast('Organization created! Verify your phone to continue.', 'success');
      navigate('/verify-phone');
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
    <AuthLayout title="Start Your Organization" subtitle="Create your manager account">
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
          <label htmlFor="register-confirm-password" className="label-field">Confirm Password</label>
          <input
            id="register-confirm-password"
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
          {loading ? 'Creating…' : 'Create Organization'}
        </button>
      </form>
      <p className="text-center text-sm text-slate-500 mt-6">
        Have an account?{' '}
        <Link to="/login" className="link-accent hover:underline">Sign in</Link>
      </p>
      <p className="text-center text-xs text-slate-400 mt-4">
        Tenants join via invite link in the mobile app
      </p>
    </AuthLayout>
  );
}
