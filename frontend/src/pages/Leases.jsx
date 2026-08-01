import { useEffect, useState } from 'react';
import api from '../api/client';
import EmptyState from '../components/EmptyState';
import PageLoader from '../components/PageLoader';
import { unwrapList } from '../utils/apiHelpers';

export default function Leases() {
  const [leases, setLeases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchLeases = () => {
    setLoading(true);
    setLoadError(false);
    api.get('/leases/')
      .then(({ data }) => setLeases(unwrapList(data)))
      .catch(() => {
        setLeases([]);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLeases(); }, []);

  if (loading) return <PageLoader message="Loading leases…" />;

  if (loadError) {
    return (
      <EmptyState
        title="Could not load leases"
        description="Check your connection and try again."
        action={
          <button type="button" onClick={fetchLeases} className="btn-secondary btn-sm">
            Retry
          </button>
        }
      />
    );
  }

  if (leases.length === 0) {
    return (
      <EmptyState
        title="No leases yet"
        description="Leases are created automatically with a Kenya-compliant agreement when tenants accept invites."
      />
    );
  }

  return (
    <div>
      <div className="bg-white rounded-xl border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Active and inactive tenancy leases</caption>
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="text-left p-4">Tenant</th>
              <th scope="col" className="text-left p-4">Property / Unit</th>
              <th scope="col" className="text-left p-4">Rent</th>
              <th scope="col" className="text-left p-4">Period</th>
              <th scope="col" className="text-left p-4">Status</th>
              <th scope="col" className="text-left p-4">Agreement</th>
            </tr>
          </thead>
          <tbody>
            {leases.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="p-4">{l.tenant_name}</td>
                <td className="p-4">{l.property_name} · Unit {l.unit_number}</td>
                <td className="p-4">KES {Number(l.rent_amount).toLocaleString()}</td>
                <td className="p-4">{l.start_date} → {l.end_date}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${l.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {l.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-4">
                  {l.lease_agreement_url ? (
                    <a href={l.lease_agreement_url} target="_blank" rel="noreferrer" className="link-accent hover:underline">View PDF</a>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
