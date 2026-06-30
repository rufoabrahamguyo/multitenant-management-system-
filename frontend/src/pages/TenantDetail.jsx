import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useFeedback } from '../context/FeedbackContext';
import { useIsOwner } from '../hooks/useIsOwner';
import api from '../api/client';
import { getApiErrorMessage } from '../utils/apiError';
import { formatKes } from '../utils/apiHelpers';

function IdCardPanel({ label, imageUrl, inputName, onUpload, uploading }) {
  return (
    <div className="card-surface p-4">
      <p className="text-sm font-semibold text-slate-900 mb-3">{label}</p>
      {imageUrl ? (
        <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block mb-3">
          <img
            src={imageUrl}
            alt={label}
            className="w-full max-h-56 object-contain rounded-xl border border-slate-200 bg-slate-50"
          />
        </a>
      ) : (
        <div className="mb-3 flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
          No image uploaded
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onUpload(e.currentTarget);
        }}
        className="space-y-3"
      >
        <input
          name={inputName}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          required={!imageUrl}
        />
        <button type="submit" disabled={uploading} className="btn-primary btn-sm">
          {uploading ? 'Uploading...' : imageUrl ? 'Replace image' : 'Upload image'}
        </button>
      </form>
    </div>
  );
}

export default function TenantDetail() {
  const { id } = useParams();
  const { toast } = useFeedback();
  const isOwner = useIsOwner();
  const [tenant, setTenant] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [exporting, setExporting] = useState(false);

  const fetchTenant = () => {
    api.get(`/tenants/${id}/`).then(({ data }) => setTenant(data));
  };

  useEffect(() => {
    fetchTenant();
  }, [id]);

  const uploadIdCard = async (form, field) => {
    const file = form[field]?.files?.[0];
    if (!file) {
      toast('Choose an image file first.', 'warning');
      return;
    }

    const fd = new FormData();
    fd.append(field, file);
    setUploading(field);
    try {
      const { data } = await api.post(`/tenants/${id}/upload-id-card/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setTenant(data);
      toast('ID image saved.', 'success');
      form.reset();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not upload ID image.'), 'error');
    } finally {
      setUploading(null);
    }
  };

  const exportDisputePack = async () => {
    setExporting(true);
    try {
      const { data } = await api.get(`/tenants/${id}/dispute_pack/`);
      window.open(data.dispute_pack_url, '_blank');
      toast('Dispute evidence pack generated.', 'success');
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not generate dispute pack.'), 'error');
    } finally {
      setExporting(false);
    }
  };

  if (!tenant) return <p className="text-slate-500">Loading tenant...</p>;

  const displayName = [tenant.first_name, tenant.last_name].filter(Boolean).join(' ') || tenant.username;

  return (
    <div>
      <Link to="/tenants" className="link-accent text-sm hover:underline">&larr; Back to tenants</Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{displayName}</h2>
          <p className="text-sm text-slate-500 mt-1">{tenant.email} · {tenant.phone_number}</p>
          {tenant.property_name && (
            <p className="text-sm mt-2 text-emerald-600">
              {tenant.property_name} · Unit {tenant.unit_number}
            </p>
          )}
        </div>
        {tenant.months_overdue > 0 ? (
          <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-medium">
            {formatKes(tenant.balance)} owed
          </span>
        ) : (
          <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            Up to date
          </span>
        )}
      </div>

      <section className="mt-8" aria-labelledby="tenant-id-heading">
        <h3 id="tenant-id-heading" className="text-lg font-bold text-slate-900 mb-1">National ID</h3>
        <p className="text-sm text-slate-500 mb-4">
          Managers and staff can store front and back photos of the tenant&apos;s ID card for verification.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <IdCardPanel
            label="ID front"
            imageUrl={tenant.id_card_front_url}
            inputName="id_card_front"
            uploading={uploading === 'id_card_front'}
            onUpload={(form) => uploadIdCard(form, 'id_card_front')}
          />
          <IdCardPanel
            label="ID back"
            imageUrl={tenant.id_card_back_url}
            inputName="id_card_back"
            uploading={uploading === 'id_card_back'}
            onUpload={(form) => uploadIdCard(form, 'id_card_back')}
          />
        </div>
      </section>

      {tenant.payment_history?.length > 0 && (
        <section className="mt-8 card-surface p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Recent payments</h3>
          <div className="space-y-2">
            {tenant.payment_history.map((p) => (
              <div key={p.month} className="flex justify-between text-sm text-slate-600">
                <span>{p.month}</span>
                <span>{formatKes(p.amount)} · {p.receipt}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {isOwner && (
        <button
          type="button"
          onClick={exportDisputePack}
          disabled={exporting}
          className="mt-6 text-sm text-indigo-600 hover:underline disabled:opacity-50"
        >
          {exporting ? 'Generating...' : 'Export dispute evidence pack'}
        </button>
      )}
    </div>
  );
}
