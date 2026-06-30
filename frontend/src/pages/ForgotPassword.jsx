import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import AuthLayout from '../components/AuthLayout';
import FormAlert from '../components/FormAlert';
import FormField from '../components/FormField';
import { getApiErrorMessage } from '../utils/apiError';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password/', { email });
      setSubmitted(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <AuthLayout title="Check your email" subtitle="Password reset">
        <p className="text-slate-600 text-sm text-center">
          If <strong>{email}</strong> is registered, a password reset link has been sent.
          Check your inbox — the link expires in 1 hour.
        </p>
        <p className="text-center text-sm text-slate-500 mt-6">
          <Link to="/login" className="link-accent hover:underline">Back to sign in</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot password?" subtitle="Enter your email to get a reset link">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <FormAlert type="error">{error}</FormAlert>}

        <FormField id="forgot-email" label="Email address">
          {({ id }) => (
            <input
              id={id}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              required
              placeholder="you@example.com"
            />
          )}
        </FormField>

        <button type="submit" disabled={loading || !email} className="btn-primary btn-md btn-block" aria-busy={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="text-center text-sm text-slate-500 mt-6">
        <Link to="/login" className="link-accent hover:underline">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
