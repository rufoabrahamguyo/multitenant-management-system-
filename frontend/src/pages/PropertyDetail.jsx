import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useFeedback } from '../context/FeedbackContext';
import { useIsOwner } from '../hooks/useIsOwner';
import api from '../api/client';
import FormField from '../components/FormField';
import { getApiErrorMessage } from '../utils/apiError';
import { unwrapList } from '../utils/apiHelpers';

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast, confirm } = useFeedback();
  const isOwner = useIsOwner();
  const [property, setProperty] = useState(null);
  const [units, setUnits] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', total_units: '' });

  const fetchData = () => {
    api.get(`/properties/${id}/`).then(({ data }) => {
      setProperty(data);
      setForm({
        name: data.name,
        address: data.address,
        total_units: String(data.units_count),
      });
    });
    api.get(`/units/?property=${id}`).then(({ data }) => setUnits(unwrapList(data)));
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/properties/${id}/`, {
        name: form.name,
        address: form.address,
        total_units: parseInt(form.total_units, 10),
      });
      toast('Property updated.', 'success');
      setEditing(false);
      fetchData();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not update property.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!property) return;
    const ok = await confirm({
      title: `Delete "${property.name}"?`,
      message: 'This permanently removes the property, all its units, leases, and related records. This cannot be undone.',
      confirmLabel: 'Delete permanently',
      variant: 'danger',
    });
    if (!ok) return;

    setDeleting(true);
    try {
      await api.delete(`/properties/${property.id}/`);
      toast(`"${property.name}" has been deleted.`, 'success');
      navigate('/properties');
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not delete property.'), 'error');
      setDeleting(false);
    }
  };

  if (!property) return <p className="text-slate-500">Loading...</p>;

  return (
    <div>
      <Link to="/properties" className="link-accent text-sm hover:underline">&larr; Back</Link>

      {editing && isOwner ? (
        <form onSubmit={handleUpdate} className="card-surface p-6 mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <h3 className="md:col-span-3 text-lg font-semibold text-slate-900">Edit property</h3>
          <FormField id="detail-property-name" label="Property name">
            {({ id }) => (
              <input
                id={id}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
                required
              />
            )}
          </FormField>
          <FormField id="detail-property-address" label="Address">
            {({ id }) => (
              <input
                id={id}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="input-field"
                required
              />
            )}
          </FormField>
          <FormField id="detail-property-units" label="Number of units">
            {({ id }) => (
              <input
                id={id}
                type="number"
                min="1"
                value={form.total_units}
                onChange={(e) => setForm({ ...form, total_units: e.target.value })}
                className="input-field"
                required
              />
            )}
          </FormField>
          <div className="md:col-span-3 flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary btn-sm disabled:opacity-50">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary btn-sm">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex justify-between items-start mt-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{property.name}</h2>
            <p className="text-slate-500">{property.address}</p>
          </div>
          {isOwner && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="btn-secondary btn-sm"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-sm text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      )}

      <h3 className="text-lg font-semibold mt-8 mb-4">Units ({units.length})</h3>
      {units.length === 0 ? (
        <div className="card-surface p-6 text-center text-sm text-slate-500">
          <p>No units yet for this property.</p>
          {isOwner && (
            <Link to="/units" className="link-accent hover:underline mt-2 inline-block">
              Add units
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {units.map((unit) => (
            <div key={unit.id} className="bg-white rounded-xl border p-4">
              <div className="flex justify-between">
                <p className="font-semibold">Unit {unit.unit_number}</p>
                <span className={`text-xs px-2 py-1 rounded-full ${unit.status === 'occupied' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{unit.status}</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">KES {Number(unit.rent_amount).toLocaleString()}/mo</p>
              {unit.tenant_name && <p className="text-sm text-slate-600 mt-2">Tenant: {unit.tenant_name}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
