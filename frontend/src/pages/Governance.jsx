import { useEffect, useState } from 'react';
import { useFeedback } from '../context/FeedbackContext';
import { useIsOwner } from '../hooks/useIsOwner';
import api from '../api/client';
import FormField from '../components/FormField';
import { getApiErrorMessage } from '../utils/apiError';
import { unwrapList } from '../utils/apiHelpers';

export default function Governance() {
  const { toast, confirm, alert } = useFeedback();
  const isOwner = useIsOwner();
  const [tab, setTab] = useState('matrix');
  const [matrix, setMatrix] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [cash, setCash] = useState([]);
  const [recon, setRecon] = useState(null);
  const [mpesaStatus, setMpesaStatus] = useState({
    mpesa_config: { stk_configured: false, shortcode: '', channel: 'stk' },
    integration_request: null,
  });
  const [mpesaForm, setMpesaForm] = useState({
    channel: 'till',
    shortcode: '',
    business_name: '',
    mpesa_username: '',
    contact_phone: '',
    contact_email: '',
    account_number: '',
    notes: '',
  });
  const [utilities, setUtilities] = useState([]);
  const [leases, setLeases] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mpesaConfigError, setMpesaConfigError] = useState(false);

  useEffect(() => {
    api.get('/auth/permission-matrix/').then(({ data }) => setMatrix(data));
    if (isOwner) {
      api.get('/auth/owner-alerts/').then(({ data }) => setAlerts(data));
    }
    api.get('/cash-collections/').then(({ data }) => setCash(unwrapList(data)));
    api.get('/reconciliation/').then(({ data }) => setRecon(data));
    api.get('/auth/mpesa-integration-request/')
      .then(({ data }) => {
        setMpesaStatus(data);
        setMpesaConfigError(false);
      })
      .catch(() => setMpesaConfigError(true));
    api.get('/utilities/').then(({ data }) => setUtilities(unwrapList(data)));
    api.get('/leases/').then(({ data }) => setLeases(unwrapList(data)));
    api.get('/tenants/').then(({ data }) => setTenants(unwrapList(data)));
  }, [isOwner]);

  const refreshCash = () => api.get('/cash-collections/').then(({ data }) => setCash(unwrapList(data)));
  const refreshRecon = () => api.get('/reconciliation/').then(({ data }) => setRecon(data));
  const refreshAlerts = () => isOwner && api.get('/auth/owner-alerts/').then(({ data }) => setAlerts(data));

  const recordCash = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setLoading(true);
    try {
      await api.post('/cash-collections/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast('Cash collection recorded, pending owner approval.', 'success');
      e.target.reset();
      refreshCash();
      refreshAlerts();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Failed to record cash.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const approveCash = async (id) => {
    try {
      await api.post(`/cash-collections/${id}/approve/`);
      toast('Cash collection approved. Payment created.', 'success');
      refreshCash();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not approve cash collection.'), 'error');
    }
  };

  const rejectCash = async (id) => {
    const ok = await confirm({
      title: 'Reject cash collection?',
      message: 'This permanently rejects the cash collection record. The staff member will need to resubmit if needed.',
      confirmLabel: 'Reject',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await api.post(`/cash-collections/${id}/reject/`, { reason: 'Rejected by owner' });
      toast('Cash collection rejected.', 'success');
      refreshCash();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not reject cash collection.'), 'error');
    }
  };

  const importCsv = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setLoading(true);
    try {
      const { data } = await api.post('/reconciliation/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast(`Imported: ${data.matched_count} matched, ${data.orphan_count} orphan transactions.`, 'success');
      refreshRecon();
      refreshAlerts();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Import failed.'), 'error');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const refreshMpesaStatus = () => api.get('/auth/mpesa-integration-request/').then(({ data }) => setMpesaStatus(data));

  const submitMpesaIntegration = async (e) => {
    e.preventDefault();
    if (!isOwner) return;
    setLoading(true);
    try {
      const { data } = await api.post('/auth/mpesa-integration-request/', mpesaForm);
      await refreshMpesaStatus();
      await alert({
        title: 'Request received',
        message: data.message || (
          'Request received. Our team will work on your M-PESA integration and get back to you shortly.'
        ),
      });
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not submit integration request.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const downloadTaxExport = async () => {
    try {
      const { data } = await api.get('/tax-export/', { responseType: 'text' });
      const blob = new Blob([data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'propizy_etims_export.csv';
      a.click();
      toast('eTIMS/tax export downloaded.', 'success');
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not download export.'), 'error');
    }
  };

  const generateDigest = async () => {
    try {
      const { data } = await api.get('/auth/weekly-digest/');
      window.open(data.digest_url, '_blank');
      toast('Weekly digest generated.', 'success');
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not generate digest.'), 'error');
    }
  };

  const exportEvidence = async (tenantId) => {
    try {
      const { data } = await api.get(`/tenants/${tenantId}/evidence-bundle/`);
      if (data.pdf_url) window.open(data.pdf_url, '_blank');
      toast(`Evidence bundle exported. SHA-256: ${data.sha256_hash?.slice(0, 16)}...`, 'success');
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not export evidence bundle.'), 'error');
    }
  };

  const addUtility = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.post('/utilities/', {
        lease: Number(fd.get('lease')),
        utility_type: fd.get('utility_type'),
        month: fd.get('month') + '-01',
        amount: fd.get('amount'),
        description: fd.get('description'),
      });
      toast('Utility charge added.', 'success');
      api.get('/utilities/').then(({ data }) => setUtilities(unwrapList(data)));
      e.target.reset();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not add utility charge.'), 'error');
    }
  };

  const tabs = [
    { id: 'matrix', label: 'Permission Matrix' },
    { id: 'cash', label: 'Cash Collections' },
    { id: 'recon', label: 'Reconciliation' },
    { id: 'mpesa', label: 'M-PESA' },
    { id: 'utilities', label: 'Utilities' },
    ...(isOwner ? [{ id: 'alerts', label: 'Owner Alerts' }, { id: 'exports', label: 'Exports & Digest' }] : []),
    { id: 'evidence', label: 'Evidence Bundles' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Governance & Trust</h2>
      <p className="text-sm text-slate-500 mb-6">
        Accountability features: RBAC, cash approval, reconciliation, evidence chains, and compliance exports.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium ${tab === t.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'matrix' && matrix && (
        <div className="bg-white rounded-xl border p-6">
          <p className="text-sm mb-4">Your role: <strong>{matrix.role}</strong></p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left p-2">Resource</th>
                  <th className="p-2">Read</th>
                  <th className="p-2">Write</th>
                  <th className="p-2">Approve/Export</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(matrix.your_permissions || {}).map(([resource, perms]) => (
                  <tr key={resource} className="border-t">
                    <td className="p-2 font-medium">{resource}</td>
                    <td className="p-2 text-center">{perms.read ? '?' : '-'}</td>
                    <td className="p-2 text-center">{perms.write ? '?' : '-'}</td>
                    <td className="p-2 text-center">{perms.approve || perms.export ? '?' : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'cash' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <form onSubmit={recordCash} className="bg-white rounded-xl border p-6 space-y-3">
            <h3 className="font-semibold">Record Cash Collection (Staff)</h3>
            <FormField id="cash-lease" label="Lease">
              {({ id }) => (
                <select id={id} name="lease_id" required className="input-field">
                  <option value="">Select lease</option>
                  {leases.map((l) => (
                    <option key={l.id} value={l.id}>{l.tenant_name || l.tenant} · Unit {l.unit_number}</option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField id="cash-amount" label="Amount (KES)">
              {({ id }) => (
                <input id={id} name="amount" type="number" step="0.01" min="0" required className="input-field" />
              )}
            </FormField>
            <FormField id="cash-notes" label="Notes (optional)">
              {({ id }) => (
                <input id={id} name="notes" className="input-field" />
              )}
            </FormField>
            <div>
              <label htmlFor="cash-receipt" className="label-field">Receipt photo</label>
              <input id="cash-receipt" name="receipt_photo" type="file" accept="image/*" className="text-sm" />
            </div>
            <button disabled={loading} className="btn-success btn-sm">Submit for Approval</button>
          </form>
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-3">Cash Collections</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {cash.map((c) => (
                <div key={c.id} className="border rounded-lg p-3 text-sm">
                  <p className="font-medium">{c.tenant_name} � KES {Number(c.amount).toLocaleString()}</p>
                  <p className="text-slate-500">{c.property_name} Unit {c.unit_number} � {c.status}</p>
                  {isOwner && c.status === 'pending' && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => approveCash(c.id)} className="btn-success btn-sm">Approve</button>
                      <button onClick={() => rejectCash(c.id)} className="px-3 py-1 bg-red-500 text-white rounded text-xs">Reject</button>
                    </div>
                  )}
                </div>
              ))}
              {cash.length === 0 && <p className="text-slate-400">No cash collections yet.</p>}
            </div>
          </div>
        </div>
      )}

      {tab === 'recon' && recon && (
        <div className="space-y-6">
          {isOwner && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold mb-2">Import M-PESA Statement (CSV)</h3>
              <p className="text-xs text-slate-500 mb-3">Columns: date, receipt, phone, amount, reference</p>
              <input type="file" accept=".csv" onChange={importCsv} className="text-sm" />
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-red-700 mb-2">Orphan Transactions ({recon.orphan_transactions?.length || 0})</h3>
              <p className="text-xs text-slate-500 mb-3">M-PESA received but not matched to tenant payment</p>
              {(recon.orphan_transactions || []).slice(0, 8).map((o) => (
                <div key={o.id} className="text-sm border-b py-2">
                  {o.receipt_number || '-'} � KES {Number(o.amount).toLocaleString()} � {o.phone_number}
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-amber-700 mb-2">Silent Tenants ({recon.silent_tenants?.length || 0})</h3>
              <p className="text-xs text-slate-500 mb-3">Expected rent this month, no completed payment</p>
              {(recon.silent_tenants || []).slice(0, 8).map((s) => (
                <div key={s.lease_id} className="text-sm border-b py-2">
                  {s.tenant_name} � {s.property_name} Unit {s.unit_number} � KES {Number(s.expected_amount).toLocaleString()}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'mpesa' && (() => {
        const { mpesa_config: mpesaConfig, integration_request: integrationRequest } = mpesaStatus;
        const openRequest = integrationRequest && ['pending', 'in_progress'].includes(integrationRequest.status);
        const showForm = isOwner && !mpesaConfig.stk_configured && !openRequest;

        return (
          <div className="bg-white rounded-xl border p-6 max-w-lg space-y-5">
            <div>
              <h3 className="font-semibold text-lg">M-PESA Payment Setup</h3>
              <p className="text-sm text-slate-500 mt-1">
                Enable tenants to pay rent directly via M-PESA STK Push (the phone prompt).
                You only need the details from your Safaricom email — our team handles the technical setup.
              </p>
            </div>

            {mpesaConfigError && (
              <p className="text-sm text-red-600" role="alert">Could not load M-PESA status. Please refresh the page.</p>
            )}

            {mpesaConfig.stk_configured && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 space-y-1">
                <p className="font-semibold">✓ M-PESA is active</p>
                <p>
                  Tenants can now pay rent via STK Push to your{' '}
                  {mpesaConfig.channel === 'till' ? 'Till Number' : 'Paybill'}{' '}
                  <strong>{mpesaConfig.shortcode}</strong>.
                  They will receive a payment prompt on their phone when they initiate a payment.
                </p>
              </div>
            )}

            {openRequest && (
              <div className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 space-y-1">
                <p className="font-semibold">Request received — we're working on it</p>
                <p>
                  We received your request for {integrationRequest.channel_display}{' '}
                  <strong>{integrationRequest.shortcode}</strong>.
                  Our team will complete your M-PESA setup within 1–2 business days and notify you by email once it's live.
                </p>
                <p className="text-xs text-blue-500 pt-1">Submitted on {integrationRequest.created_at?.slice(0, 10)}</p>
              </div>
            )}

            {integrationRequest?.status === 'rejected' && !mpesaConfig.stk_configured && (
              <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-1">
                <p className="font-semibold">We could not complete your previous request</p>
                {integrationRequest.admin_notes ? (
                  <p className="mt-1">{integrationRequest.admin_notes}</p>
                ) : (
                  <p className="mt-1">Please check your details and submit a new request below.</p>
                )}
              </div>
            )}

            {showForm && (
              <>
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-700 space-y-1">
                  <p className="font-medium text-slate-800">What you'll need from your Safaricom email:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                    <li>Your Till Number or Paybill number</li>
                    <li>Your business / organisation name (as registered with Safaricom)</li>
                    <li>Your M-PESA portal username (in the Safaricom onboarding email)</li>
                  </ul>
                  <p className="text-xs text-slate-400 pt-1">You do not need to share any passwords or secret keys.</p>
                </div>

                <form onSubmit={submitMpesaIntegration} className="space-y-4">
                  <FormField id="mpesa-req-channel" label="How do your customers pay you?">
                    {({ id }) => (
                      <select
                        id={id}
                        value={mpesaForm.channel}
                        onChange={(e) => setMpesaForm({ ...mpesaForm, channel: e.target.value })}
                        className="input-field"
                        required
                      >
                        <option value="till">Till Number (Buy Goods)</option>
                        <option value="paybill">Paybill</option>
                      </select>
                    )}
                  </FormField>

                  <FormField id="mpesa-req-shortcode" label={mpesaForm.channel === 'till' ? 'Till Number' : 'Paybill Number'}>
                    {({ id }) => (
                      <>
                        <input
                          id={id}
                          value={mpesaForm.shortcode}
                          onChange={(e) => setMpesaForm({ ...mpesaForm, shortcode: e.target.value.replace(/\D/g, '') })}
                          className="input-field"
                          placeholder={mpesaForm.channel === 'till' ? 'e.g. 123456' : 'e.g. 600123'}
                          inputMode="numeric"
                          required
                        />
                        <p className="text-xs text-slate-400 mt-0.5">The number your customers send money to</p>
                      </>
                    )}
                  </FormField>

                  <FormField id="mpesa-req-business" label="Business / organisation name">
                    {({ id }) => (
                      <>
                        <input
                          id={id}
                          value={mpesaForm.business_name}
                          onChange={(e) => setMpesaForm({ ...mpesaForm, business_name: e.target.value })}
                          className="input-field"
                          placeholder="Exactly as it appears in your Safaricom email"
                          required
                        />
                        <p className="text-xs text-slate-400 mt-0.5">Copy it exactly from the Safaricom email — spelling and spacing matter</p>
                      </>
                    )}
                  </FormField>

                  <FormField id="mpesa-req-username" label="M-PESA portal username">
                    {({ id }) => (
                      <>
                        <input
                          id={id}
                          value={mpesaForm.mpesa_username}
                          onChange={(e) => setMpesaForm({ ...mpesaForm, mpesa_username: e.target.value })}
                          className="input-field"
                          placeholder="e.g. john.doe@mybusiness.co.ke"
                          required
                        />
                        <p className="text-xs text-slate-400 mt-0.5">
                          This is the login username Safaricom gave you for the M-PESA Business portal — it's in your onboarding email
                        </p>
                      </>
                    )}
                  </FormField>

                  {mpesaForm.channel === 'paybill' && (
                    <FormField id="mpesa-req-account" label="Default account number (optional)">
                      {({ id }) => (
                        <>
                          <input
                            id={id}
                            value={mpesaForm.account_number}
                            onChange={(e) => setMpesaForm({ ...mpesaForm, account_number: e.target.value })}
                            className="input-field"
                            placeholder="e.g. RENT or unit number prefix"
                          />
                          <p className="text-xs text-slate-400 mt-0.5">
                            This will be prefixed to the tenant's account reference (e.g. RENT-123). Leave blank if unsure.
                          </p>
                        </>
                      )}
                    </FormField>
                  )}

                  <FormField id="mpesa-req-phone" label="Your contact phone number">
                    {({ id }) => (
                      <input
                        id={id}
                        value={mpesaForm.contact_phone}
                        onChange={(e) => setMpesaForm({ ...mpesaForm, contact_phone: e.target.value })}
                        className="input-field"
                        placeholder="e.g. 0712 345 678"
                        inputMode="tel"
                        required
                      />
                    )}
                  </FormField>

                  <FormField id="mpesa-req-email" label="Contact email (optional)">
                    {({ id }) => (
                      <>
                        <input
                          id={id}
                          type="email"
                          value={mpesaForm.contact_email}
                          onChange={(e) => setMpesaForm({ ...mpesaForm, contact_email: e.target.value })}
                          className="input-field"
                          placeholder="We'll send your confirmation here"
                        />
                        <p className="text-xs text-slate-400 mt-0.5">Recommended — we'll email you when M-PESA is live</p>
                      </>
                    )}
                  </FormField>

                  <FormField id="mpesa-req-notes" label="Anything else from your Safaricom email? (optional)">
                    {({ id }) => (
                      <textarea
                        id={id}
                        value={mpesaForm.notes}
                        onChange={(e) => setMpesaForm({ ...mpesaForm, notes: e.target.value })}
                        className="input-field min-h-[80px]"
                        placeholder="Paste any extra details or instructions from the Safaricom email here"
                        rows={3}
                      />
                    )}
                  </FormField>

                  <button type="submit" className="btn-primary w-full" disabled={loading}>
                    {loading ? 'Submitting…' : 'Request M-PESA integration'}
                  </button>
                  <p className="text-xs text-center text-slate-400">
                    Our team will review and activate within 1–2 business days.
                    You will be notified by email.
                  </p>
                </form>
              </>
            )}

            {!isOwner && !mpesaConfig.stk_configured && !openRequest && (
              <p className="text-sm text-slate-500">Only the organization owner can request M-PESA integration. Contact your account owner.</p>
            )}
          </div>
        );
      })()}

      {tab === 'utilities' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {isOwner && (
            <form onSubmit={addUtility} className="bg-white rounded-xl border p-6 space-y-3">
              <h3 className="font-semibold">Add Utility / Service Charge</h3>
              <FormField id="utility-lease" label="Lease">
                {({ id }) => (
                  <select id={id} name="lease" required className="input-field">
                    <option value="">Select lease</option>
                    {leases.map((l) => (
                      <option key={l.id} value={l.id}>{l.tenant_name || l.tenant} · Unit {l.unit_number}</option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField id="utility-type" label="Utility type">
                {({ id }) => (
                  <select id={id} name="utility_type" className="input-field">
                    <option value="water">Water</option>
                    <option value="electricity">Electricity</option>
                    <option value="service">Service Charge</option>
                    <option value="garbage">Garbage</option>
                    <option value="other">Other</option>
                  </select>
                )}
              </FormField>
              <FormField id="utility-month" label="Month">
                {({ id }) => (
                  <input id={id} name="month" type="month" required className="input-field" />
                )}
              </FormField>
              <FormField id="utility-amount" label="Amount (KES)">
                {({ id }) => (
                  <input id={id} name="amount" type="number" step="0.01" min="0" required className="input-field" />
                )}
              </FormField>
              <FormField id="utility-description" label="Description">
                {({ id }) => (
                  <input id={id} name="description" className="input-field" />
                )}
              </FormField>
              <button className="btn-primary btn-sm">Add Charge</button>
            </form>
          )}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-3">Utility Charges</h3>
            {utilities.map((u) => (
              <div key={u.id} className="text-sm border-b py-2">
                {u.tenant_name} � {u.utility_type} � KES {Number(u.amount).toLocaleString()} � {u.month?.slice(0, 7)}
              </div>
            ))}
            {utilities.length === 0 && <p className="text-slate-400 text-sm">No utility charges yet.</p>}
          </div>
        </div>
      )}

      {tab === 'alerts' && isOwner && (
        <div className="bg-white rounded-xl border p-6 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Owner Alerts</h3>
            <button onClick={() => api.patch('/auth/owner-alerts/').then(() => {
              refreshAlerts();
              toast('All alerts marked as read.', 'success');
            }).catch((err) => toast(getApiErrorMessage(err, 'Could not update alerts.'), 'error'))} className="text-xs link-accent">Mark all read</button>
          </div>
          {alerts.map((a) => (
            <div key={a.id} className={`border rounded-lg p-3 text-sm ${a.is_read ? 'opacity-60' : ''}`}>
              <span className={`text-xs px-2 py-0.5 rounded ${a.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                {a.alert_type}
              </span>
              <p className="mt-1">{a.message}</p>
              <p className="text-xs text-slate-400">{a.created_at?.slice(0, 16)}</p>
            </div>
          ))}
          {alerts.length === 0 && <p className="text-slate-400">No alerts.</p>}
        </div>
      )}

      {tab === 'exports' && isOwner && (
        <div className="bg-white rounded-xl border p-6 flex flex-wrap gap-3">
          <button onClick={downloadTaxExport} className="btn-primary btn-sm">Download eTIMS/Tax CSV</button>
          <button onClick={generateDigest} className="btn-primary btn-sm">Generate Weekly Digest PDF</button>
        </div>
      )}

      {tab === 'evidence' && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold mb-3">Export Evidence Bundle (PDF + JSON + SHA-256)</h3>
          {isOwner ? tenants.map((t) => (
            <div key={t.id} className="flex justify-between items-center border-b py-2 text-sm">
              <span>{t.username || t.first_name || `Tenant ${t.id}`}</span>
              <button onClick={() => exportEvidence(t.id)} className="btn-primary btn-sm">Export Bundle</button>
            </div>
          )) : (
            <p className="text-slate-500 text-sm">Evidence bundle export is owner-only.</p>
          )}
        </div>
      )}
    </div>
  );
}
