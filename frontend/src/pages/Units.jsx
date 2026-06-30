import { useEffect, useState } from 'react';
import { useFeedback } from '../context/FeedbackContext';
import { useIsOwner } from '../hooks/useIsOwner';
import api from '../api/client';
import FormField from '../components/FormField';
import { getApiErrorMessage } from '../utils/apiError';
import { unwrapList } from '../utils/apiHelpers';

export default function Units() {
  const { toast, confirm } = useFeedback();
  const isOwner = useIsOwner();
  const [units, setUnits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState(null);
  const [editForm, setEditForm] = useState({ unit_number: '', rent_amount: '', category: '' });
  const [form, setForm] = useState({ property: '', category: '', unit_number: '', rent_amount: '' });
  const [catForm, setCatForm] = useState({ property_ref: '', name: '', description: '' });

  const fetchAll = () => {
    api.get('/units/').then(({ data }) => setUnits(unwrapList(data)));
    api.get('/unit-categories/').then(({ data }) => setCategories(unwrapList(data)));
    api.get('/properties/').then(({ data }) => setProperties(unwrapList(data)));
    api.get('/tenants/').then(({ data }) => setTenants(unwrapList(data)));
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/units/', {
        property: parseInt(form.property, 10),
        category: form.category ? parseInt(form.category, 10) : null,
        unit_number: form.unit_number,
        rent_amount: form.rent_amount,
      });
      setShowForm(false);
      setForm({ property: '', category: '', unit_number: '', rent_amount: '' });
      toast(`Unit ${form.unit_number} created.`, 'success');
      fetchAll();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not create unit.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    setSaving(true);
    const categoryName = catForm.name;
    try {
      await api.post('/unit-categories/', {
        property_ref: parseInt(catForm.property_ref, 10),
        name: catForm.name,
        description: catForm.description,
      });
      setShowCatForm(false);
      setCatForm({ property_ref: '', name: '', description: '' });
      toast(`Category "${categoryName}" created.`, 'success');
      fetchAll();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not create category.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const assignTenant = async (unitId, tenantId) => {
    if (!tenantId) return;
    try {
      await api.post(`/units/${unitId}/assign_tenant/`, { tenant_id: tenantId });
      toast('Tenant assigned and lease created.', 'success');
      fetchAll();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not assign tenant.'), 'error');
    }
  };

  const startEditUnit = (unit) => {
    setEditingUnitId(unit.id);
    setEditForm({
      unit_number: unit.unit_number,
      rent_amount: String(unit.rent_amount),
      category: unit.category ? String(unit.category) : '',
    });
  };

  const cancelEditUnit = () => {
    setEditingUnitId(null);
    setEditForm({ unit_number: '', rent_amount: '', category: '' });
  };

  const saveEditUnit = async (unit) => {
    setSaving(true);
    try {
      await api.patch(`/units/${unit.id}/`, {
        unit_number: editForm.unit_number,
        rent_amount: editForm.rent_amount,
        category: editForm.category ? parseInt(editForm.category, 10) : null,
      });
      toast(`Unit ${editForm.unit_number} updated.`, 'success');
      cancelEditUnit();
      fetchAll();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not update unit.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteUnit = async (unit) => {
    const ok = await confirm({
      title: `Delete Unit ${unit.unit_number}?`,
      message: `This permanently removes Unit ${unit.unit_number} at ${unit.property_name}. This cannot be undone.`,
      confirmLabel: 'Delete permanently',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await api.delete(`/units/${unit.id}/`);
      toast(`Unit ${unit.unit_number} deleted.`, 'success');
      fetchAll();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not delete unit. It may still be occupied or linked to a lease.'), 'error');
    }
  };

  const deleteCategory = async (cat) => {
    const ok = await confirm({
      title: `Delete "${cat.name}"?`,
      message: 'Units in this category will be unlinked. This cannot be undone.',
      confirmLabel: 'Delete permanently',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await api.delete(`/unit-categories/${cat.id}/`);
      toast(`Category "${cat.name}" deleted.`, 'success');
      fetchAll();
    } catch (err) {
      toast(getApiErrorMessage(err, 'Could not delete category.'), 'error');
    }
  };

  const catsForProperty = (propertyId) =>
    categories.filter((c) => c.property_ref === propertyId);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Units & Room Categories</h2>
        {isOwner && (
          <div className="flex gap-2">
            <button onClick={() => setShowCatForm(!showCatForm)} className="btn-primary btn-sm">
              {showCatForm ? 'Cancel' : '+ Add Category'}
            </button>
            <button onClick={() => setShowForm(!showForm)} className="btn-primary btn-sm">
              {showForm ? 'Cancel' : '+ Add Unit'}
            </button>
          </div>
        )}
      </div>

      {showCatForm && isOwner && (
        <form onSubmit={handleCreateCategory} className="card-surface p-6 mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FormField id="cat-property" label="Property">
            {({ id }) => (
              <select id={id} value={catForm.property_ref} onChange={(e) => setCatForm({ ...catForm, property_ref: e.target.value })} className="input-field" required>
                <option value="">Select property</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </FormField>
          <FormField id="cat-name" label="Category name">
            {({ id }) => (
              <input id={id} value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} className="input-field" placeholder="e.g. Studio, Premium" required />
            )}
          </FormField>
          <FormField id="cat-description" label="Description">
            {({ id }) => (
              <input id={id} value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} className="input-field" />
            )}
          </FormField>
          <div className="flex items-end">
            <button type="submit" disabled={saving} className="btn-primary btn-sm w-full">
              {saving ? 'Creating…' : 'Create Category'}
            </button>
          </div>
        </form>
      )}

      {showForm && isOwner && (
        <form onSubmit={handleCreate} className="card-surface p-6 mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <FormField id="unit-property" label="Property">
            {({ id }) => (
              <select id={id} value={form.property} onChange={(e) => setForm({ ...form, property: e.target.value, category: '' })} className="input-field" required>
                <option value="">Select property</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </FormField>
          <FormField id="unit-category" label="Category (optional)">
            {({ id }) => (
              <select id={id} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field">
                <option value="">None</option>
                {catsForProperty(Number(form.property)).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </FormField>
          <FormField id="unit-number" label="Unit number">
            {({ id }) => (
              <input id={id} value={form.unit_number} onChange={(e) => setForm({ ...form, unit_number: e.target.value })} className="input-field" required />
            )}
          </FormField>
          <FormField id="unit-rent" label="Rent amount (KES)">
            {({ id }) => (
              <input id={id} type="number" min="0" value={form.rent_amount} onChange={(e) => setForm({ ...form, rent_amount: e.target.value })} className="input-field" required />
            )}
          </FormField>
          <div className="flex items-end">
            <button type="submit" disabled={saving} className="btn-primary btn-sm w-full">
              {saving ? 'Creating…' : 'Create Unit'}
            </button>
          </div>
        </form>
      )}

      {categories.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {categories.map((c) => (
            <div key={c.id} className="bg-white border rounded-lg p-3 text-sm relative group">
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-slate-500">{c.property_name}</p>
              <p className="text-xs text-green-600 mt-1">{c.vacant_count} vacant · {c.unit_count} total</p>
              {isOwner && (
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => deleteCategory(c)}
                    className="text-xs text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        {units.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No units yet. {isOwner ? 'Add a category or unit using the buttons above.' : 'Ask your organization owner to add units.'}
          </p>
        ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-4">Property</th>
              <th className="text-left p-4">Category</th>
              <th className="text-left p-4">Unit</th>
              <th className="text-left p-4">Rent</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Tenant</th>
              <th className="text-left p-4">Assign</th>
              {isOwner && <th className="text-left p-4">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit.id} className="border-t">
                <td className="p-4">{unit.property_name}</td>
                <td className="p-4">
                  {editingUnitId === unit.id ? (
                    <select
                      className="border rounded px-2 py-1 text-xs w-full"
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    >
                      <option value="">None</option>
                      {catsForProperty(unit.property).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    unit.category_name || '-'
                  )}
                </td>
                <td className="p-4 font-medium">
                  {editingUnitId === unit.id ? (
                    <input
                      className="border rounded px-2 py-1 text-xs w-full"
                      value={editForm.unit_number}
                      onChange={(e) => setEditForm({ ...editForm, unit_number: e.target.value })}
                    />
                  ) : (
                    unit.unit_number
                  )}
                </td>
                <td className="p-4">
                  {editingUnitId === unit.id ? (
                    <input
                      type="number"
                      min="0"
                      className="border rounded px-2 py-1 text-xs w-full"
                      value={editForm.rent_amount}
                      onChange={(e) => setEditForm({ ...editForm, rent_amount: e.target.value })}
                    />
                  ) : (
                    `KES ${Number(unit.rent_amount).toLocaleString()}`
                  )}
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    unit.status === 'occupied' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{unit.status}</span>
                </td>
                <td className="p-4">{unit.tenant_name || '-'}</td>
                <td className="p-4">
                  {isOwner && unit.status === 'vacant' && (
                    <select
                      className="border rounded px-2 py-1 text-xs"
                      onChange={(e) => e.target.value && assignTenant(unit.id, e.target.value)}
                      defaultValue=""
                    >
                      <option value="">Assign...</option>
                      {tenants.map((t) => <option key={t.id} value={t.id}>{t.username}</option>)}
                    </select>
                  )}
                </td>
                {isOwner && (
                  <td className="p-4">
                    <div className="flex gap-2">
                      {editingUnitId === unit.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveEditUnit(unit)}
                            disabled={saving}
                            className="text-xs text-emerald-700 hover:underline disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditUnit}
                            className="text-xs text-slate-600 hover:underline"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditUnit(unit)}
                            className="text-xs text-slate-700 hover:underline"
                          >
                            Edit
                          </button>
                          {unit.status === 'vacant' && (
                            <button
                              type="button"
                              onClick={() => deleteUnit(unit)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
