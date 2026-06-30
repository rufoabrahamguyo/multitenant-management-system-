import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import AuthLayout from '../components/AuthLayout';
import FormAlert from '../components/FormAlert';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { getApiErrorMessage } from '../utils/apiError';

const ERROR_ID = 'verify-phone-error';

export default function VerifyPhone() {
  const { user, updateUser } = useAuth();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [maskedPhone, setMaskedPhone] = useState(user?.phone_masked || '');
  const [devCode, setDevCode] = useState('');
  const [smsSimulated, setSmsSimulated] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.phone_verified) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const sendCode = async () => {
    setSending(true);
    setError('');
    try {
      const { data } = await api.post('/auth/phone/send-code/');
      setMaskedPhone(data.masked_phone || user?.phone_masked || '');
      setSmsSimulated(Boolean(data.sms_simulated));
      if (data.dev_code) setDevCode(data.dev_code);
      if (data.sms_simulated) {
        toast('SMS not delivered. Use the dev code shown below.', 'warning', 5000);
      } else {
        toast('Verification code sent to your phone.', 'success', 3000);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send verification code.'));
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (user && !user.phone_verified) {
      sendCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/phone/verify/', { code });
      updateUser(data.user);
      toast('Phone verified! Welcome to Propizy.', 'success');
      navigate('/dashboard');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid or expired code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.phone_verified) return null;

  return (
    <AuthLayout title="Welcome to Propizy">
      <p className="text-center text-slate-600 text-sm leading-relaxed -mt-2 mb-6">
        We will send a verification code to{' '}
        <span className="font-mono font-medium text-slate-900">{maskedPhone || 'your phone'}</span>
      </p>
      <p className="text-center text-slate-500 text-sm -mt-4 mb-6">
        Please verify your phone number to continue using the app
      </p>

      {smsSimulated && (
        <FormAlert type="warning">
          SMS was not sent to your phone (simulator/emulator cannot receive texts, or Africa&apos;s Talking is not configured).
          {devCode ? (
            <> Use this code: <span className="font-mono font-bold">{devCode}</span></>
          ) : (
            ' Check backend logs or Africa\'s Talking dashboard.'
          )}
        </FormAlert>
      )}

      {!smsSimulated && devCode && (
        <FormAlert type="warning">
          Dev code: <span className="font-mono font-bold">{devCode}</span>
        </FormAlert>
      )}

      {error && <div className="mb-4"><FormAlert type="error" id={ERROR_ID}>{error}</FormAlert></div>}

      <form onSubmit={handleVerify} className="space-y-4" aria-describedby={error ? ERROR_ID : undefined} noValidate>
        <div>
          <label htmlFor="verify-code" className="label-field">Verification code</label>
          <input
            id="verify-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter 6-digit code"
            className="input-field text-center text-lg tracking-widest font-mono"
            required
            aria-invalid={Boolean(error)}
          />
        </div>
        <button
          type="submit"
          disabled={loading || code.length < 6}
          className="btn-primary btn-md btn-block"
          aria-busy={loading}
        >
          {loading ? 'Verifying…' : 'Verify phone number'}
        </button>
      </form>

      <button
        type="button"
        onClick={sendCode}
        disabled={sending}
        className="w-full mt-4 text-sm link-accent disabled:opacity-50 min-h-[44px]"
        aria-busy={sending}
      >
        {sending ? 'Sending...' : 'Resend code'}
      </button>
    </AuthLayout>
  );
}
