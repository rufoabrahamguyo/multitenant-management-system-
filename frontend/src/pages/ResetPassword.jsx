import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import AuthLayout from '../components/AuthLayout';
import FormAlert from '../components/FormAlert';
import FormField from '../components/FormField';
import { useFeedback } from '../context/FeedbackContext';
import { getApiErrorMessage } from '../utils/apiError';
import { validatePassword } from '../utils/apiHelpers';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useFeedback();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordsMatch = !confirm || password === confirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password/', { token, password });
      toast('Password reset successfully. Please sign in.', 'success');
      navigate('/login');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid or expired reset link. Please request a new one.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Set new password" subtitle="Choose a strong password">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <FormAlert type="error">{error}</FormAlert>}

        <FormField id="reset-password" label="New password">
          {({ id }) => (
            <input
              id={id}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              required
            />
          )}
        </FormField>

        <div>
          <label htmlFor="reset-confirm" className="label-field">Confirm new password</label>
          <input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={`input-field ${!passwordsMatch ? 'border-red-400 focus:border-red-400 focus:ring-red-500/30' : ''}`}
            required
            aria-invalid={!passwordsMatch}
          />
          {!passwordsMatch && (
            <p className="text-red-600 text-xs mt-1.5" role="alert">Passwords do not match.</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !password || !confirm || !passwordsMatch}
          className="btn-primary btn-md btn-block"
          aria-busy={loading}
        >
          {loading ? 'Saving…' : 'Reset password'}
        </button>
      </form>
      <p className="text-center text-sm text-slate-500 mt-6">
        <Link to="/login" className="link-accent hover:underline">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
