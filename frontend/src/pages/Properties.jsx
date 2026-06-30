import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFeedback } from '../context/FeedbackContext';
import { useIsOwner } from '../hooks/useIsOwner';
import api from '../api/client';
import EmptyState from '../components/EmptyState';
import PageLoader from '../components/PageLoader';
import FormField from '../components/FormField';
import { getApiErrorMessage } from '../utils/apiError';
import { unwrapList } from '../utils/apiHelpers';

const emptyForm = { name: '', address: '', total_units: '' };

export default function Properties() {
  const { toast, confirm } = useFeedback();
  const isOwner = useIsOwner();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const fetchProperties = () => {
    setLoadError(false);
    api.get('/properties/')
      .then(({ data }) => {
        setProperties(unwrapList(data));
        setLoading(false);
      })
      .catch(() => {
        setLoadError(true);
        setLoading(false);
      });
  };

  useEffect(() => { fetchProperties(); }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const propertyName = form.name;
    try {
      await api.post('/properties/', {
        ...form,
        total_units: parseInt(form.total_units, 10),
      });
      resetForm();
      toast(`Property "${propertyName}" created.`, 'success');
      fetchProperties();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not create property.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/properties/${editingId}/`, {
        name: form.name,
        address: form.address,
        total_units: parseInt(form.total_units, 10),
      });
      toast(`Property "${form.name}" updated.`, 'success');
      resetForm();
      fetchProperties();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not update property.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (prop) => {
    setShowForm(false);
    setEditingId(prop.id);
    setForm({
      name: prop.name,
      address: prop.address,
      total_units: String(prop.units_count),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (prop) => {
    const ok = await confirm({
      title: `Delete "${prop.name}"?`,
      message: 'This permanently removes the property, all its units, leases, and related records. This cannot be undone.',
      confirmLabel: 'Delete permanently',
      variant: 'danger',
    });
    if (!ok) return;

    setDeletingId(prop.id);
    try {
      await api.delete(`/properties/${prop.id}/`);
      if (editingId === prop.id) resetForm();
      toast(`"${prop.name}" has been deleted.`, 'success');
      fetchProperties();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not delete property.'), 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const showPropertyForm = (showForm || editingId) && isOwner;

  if (loading) return <PageLoader message="Loading properties…" />;

  if (loadError) {
    return (
      <EmptyState
        title="Could not load properties"
        description="Check your connection and try again."
        action={
          <button type="button" onClick={fetchProperties} className="btn-secondary btn-sm">
            Retry
          </button>
        }
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="page-title">Properties</h2>
        {isOwner && !editingId && (
          <button
            type="button"
            onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); }}
            className="btn-primary btn-sm"
          >
            {showForm ? 'Cancel' : '+ Add Property'}
          </button>
        )}
      </div>

      {showPropertyForm && (
        <form
          onSubmit={editingId ? handleUpdate : handleCreate}
          className="card-surface p-6 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <h3 className="md:col-span-3 text-sm font-semibold text-slate-700">
            {editingId ? 'Edit property' : 'New property'}
          </h3>
          <FormField id="property-name" label="Property name">
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
          <FormField id="property-address" label="Address">
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
          <FormField id="property-units" label="Number of units">
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
          <p className="md:col-span-3 text-xs text-slate-500 -mt-2">
            {editingId
              ? 'Increasing the count adds vacant units. To reduce units, delete vacant ones on the Units page first.'
              : 'Vacant units are created automatically (numbered 1, 2, 3…). Set rent on the Units page.'}
          </p>
          <div className="md:col-span-3 flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary btn-sm disabled:opacity-50">
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create property'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="btn-secondary btn-sm">
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {properties.length === 0 ? (
        <EmptyState
          title="No properties yet"
          description={isOwner ? 'Add your first property to start managing units and tenants.' : 'Your organization has not added any properties yet.'}
          action={isOwner && (
            <button type="button" onClick={() => setShowForm(true)} className="btn-primary btn-sm">
              Add property
            </button>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((prop) => (
            <div key={prop.id} className="card-surface p-6 flex flex-col">
              <Link
                to={`/properties/${prop.id}`}
                className="flex-1 hover:opacity-90 transition-opacity"
              >
                <h3 className="text-lg font-semibold text-slate-900">{prop.name}</h3>
                <p className="text-sm text-slate-500 mt-2">{prop.address}</p>
                <div className="flex gap-4 mt-4 text-sm">
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm font-medium">
                    {prop.units_count} units
                  </span>
                </div>
              </Link>
              {isOwner && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => startEdit(prop)}
                    className="btn-secondary btn-sm flex-1"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(prop)}
                    disabled={deletingId === prop.id}
                    className="text-sm text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50 flex-1"
                  >
                    {deletingId === prop.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
