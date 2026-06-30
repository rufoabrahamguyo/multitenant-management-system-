import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import AuthLayout from '../components/AuthLayout';
import FormAlert from '../components/FormAlert';
import LoadingScreen from '../components/LoadingScreen';

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function TenantInviteLanding() {
  const { token } = useParams();
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const appUrl = preview?.app_invite_url || `propizy://invite/${token}`;
  const webUrl = `${window.location.origin}/invite/${token}`;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setPreviewError('');
      try {
        const { data } = await api.get(`/auth/invite/${token}/`);
        if (!cancelled) setPreview(data);
      } catch {
        if (!cancelled) setPreviewError('This invite link is invalid or has expired.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (preview?.is_valid && isMobileDevice()) {
      window.location.href = appUrl;
    }
  }, [preview, appUrl]);

  const openInApp = () => {
    window.location.href = appUrl;
  };

  const copyLink = () => {
    navigator.clipboard.writeText(webUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <LoadingScreen />;

  if (previewError || !preview?.is_valid) {
    return (
      <AuthLayout title="Invalid Invite" subtitle="This tenant invite cannot be used">
        <FormAlert type="error">
          {previewError || 'This invite has expired or already been used.'}
        </FormAlert>
        <p className="text-center text-sm text-slate-500 mt-6">
          Ask your property manager to send a new invite.
        </p>
        <p className="text-center text-sm text-slate-500 mt-4">
          <Link to="/" className="link-accent hover:underline">Back to home</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="You're Invited"
      subtitle={`Join ${preview.organization} on Propizy`}
    >
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6 space-y-2">
        {preview.unit && (
          <p className="text-sm text-slate-700">
            <span className="font-medium">Unit:</span> {preview.unit}
          </p>
        )}
        <p className="text-sm text-slate-700">
          <span className="font-medium">Email:</span> {preview.email}
        </p>
        {preview.expires_at && (
          <p className="text-xs text-slate-500">
            Expires {new Date(preview.expires_at).toLocaleDateString('en-KE', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </p>
        )}
      </div>

      <p className="text-sm text-slate-600 text-center mb-6">
        Tenants register in the <strong>Propizy mobile app</strong>. Tap below to open the app
        and create your account.
      </p>

      <button type="button" onClick={openInApp} className="btn-primary btn-md btn-block mb-3">
        Open in Propizy App
      </button>

      <button type="button" onClick={copyLink} className="btn-secondary btn-md btn-block">
        {copied ? 'Link Copied!' : 'Copy Invite Link'}
      </button>

      <p className="text-center text-xs text-slate-400 mt-6">
        Don&apos;t have the app? Install Propizy from the App Store or Google Play,
        then return to this link.
      </p>
    </AuthLayout>
  );
}
