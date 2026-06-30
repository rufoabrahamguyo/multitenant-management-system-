import { useEffect, useState } from 'react';
import api from '../api/client';
import { unwrapList } from '../utils/apiHelpers';

export default function Leases() {
  const [leases, setLeases] = useState([]);

  useEffect(() => {
    api.get('/leases/').then(({ data }) => setLeases(unwrapList(data)));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-6">Leases</h2>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-4">Tenant</th>
              <th className="text-left p-4">Property / Unit</th>
              <th className="text-left p-4">Rent</th>
              <th className="text-left p-4">Period</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Agreement</th>
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
        {leases.length === 0 && <p className="text-center text-slate-500 py-8">Leases are created automatically with a Kenya-compliant agreement when tenants accept invites.</p>}
      </div>
    </div>
  );
}
