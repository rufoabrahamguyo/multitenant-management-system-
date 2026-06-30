import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import api from '../api/client';

export default function MyUnitScreen() {
  const [lease, setLease] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    api.get('/my-lease/').then(({ data }) => {
      const leases = data.results || data;
      if (leases.length > 0) setLease(leases[0]);
    });
    api.get('/unit-availability/').then(({ data }) => setAvailability(data)).catch(() => {});
    api.get('/transfer-requests/').then(({ data }) => setMyRequests(data.results || data)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const submitRequest = async () => {
    if (!selectedCategory) {
      Alert.alert('Select a category', 'Choose the room type you want to move to.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/transfer-requests/', {
        desired_category_id: selectedCategory,
        preferred_unit_id: selectedUnit || undefined,
        tenant_note: note,
      });
      Alert.alert('Request submitted', 'Your property manager will review your room change request.');
      setSelectedCategory(null);
      setSelectedUnit(null);
      setNote('');
      load();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Could not submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (id) => {
    await api.post(`/transfer-requests/${id}/cancel/`);
    load();
  };

  const activeRequest = myRequests.find((r) =>
    ['pending', 'waitlisted', 'approved'].includes(r.status),
  );

  if (!lease) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No unit assigned.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{lease.property_name}</Text>
        <Text style={styles.unit}>Unit {lease.unit_number}</Text>
        {lease.category_name && (
          <Text style={styles.category}>{lease.category_name}</Text>
        )}
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Rent</Text>
          <Text style={styles.value}>KES {Number(lease.rent_amount).toLocaleString()}/mo</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Lease</Text>
          <Text style={styles.value}>{lease.start_date} · {lease.end_date}</Text>
        </View>
      </View>

      {activeRequest ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your Transfer Request</Text>
          <Text style={styles.value}>
            → {activeRequest.desired_category_name} ({activeRequest.status})
          </Text>
          {activeRequest.waitlist_position && (
            <Text style={styles.waitlist}>Waitlist position: #{activeRequest.waitlist_position}</Text>
          )}
          {activeRequest.preferred_unit_number && (
            <Text style={styles.label}>Preferred: Unit {activeRequest.preferred_unit_number}</Text>
          )}
          <TouchableOpacity style={styles.cancelBtn} onPress={() => cancelRequest(activeRequest.id)}>
            <Text style={styles.cancelText}>Cancel Request</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Available Room Categories</Text>
          {availability.map((cat) => (
            <TouchableOpacity
              key={cat.category_id}
              style={[styles.catCard, selectedCategory === cat.category_id && styles.catSelected]}
              onPress={() => {
                setSelectedCategory(cat.category_id);
                setSelectedUnit(null);
              }}
            >
              <Text style={styles.catName}>{cat.category_name}</Text>
              <Text style={styles.catMeta}>
                {cat.vacant_count} vacant · {cat.waitlist_count} on waitlist
              </Text>
              {cat.description ? <Text style={styles.catDesc}>{cat.description}</Text> : null}
            </TouchableOpacity>
          ))}

          {selectedCategory && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Choose a Unit (optional)</Text>
              {(availability.find((c) => c.category_id === selectedCategory)?.vacant_units || []).map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={[styles.unitOption, selectedUnit === u.id && styles.unitSelected]}
                  onPress={() => setSelectedUnit(u.id)}
                >
                  <Text>Unit {u.unit_number} · KES {Number(u.rent_amount).toLocaleString()}</Text>
                </TouchableOpacity>
              ))}
              <TextInput
                style={styles.input}
                placeholder="Note to property manager (optional)"
                value={note}
                onChangeText={setNote}
              />
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.disabled]}
                onPress={submitRequest}
                disabled={submitting}
              >
                <Text style={styles.submitText}>
                  {submitting ? 'Submitting...' : 'Request Room Change'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#94a3b8', fontSize: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
  unit: { fontSize: 16, color: '#64748b', marginTop: 4 },
  category: { fontSize: 14, color: '#2563eb', marginTop: 4, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  label: { color: '#64748b', fontSize: 14 },
  value: { color: '#1e293b', fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  catCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 2, borderColor: 'transparent' },
  catSelected: { borderColor: '#2563eb' },
  catName: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  catMeta: { fontSize: 13, color: '#64748b', marginTop: 4 },
  catDesc: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  unitOption: { padding: 12, borderRadius: 8, backgroundColor: '#f1f5f9', marginBottom: 8 },
  unitSelected: { backgroundColor: '#dbeafe', borderWidth: 1, borderColor: '#2563eb' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, marginTop: 12, marginBottom: 12 },
  submitBtn: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.6 },
  waitlist: { color: '#d97706', marginTop: 8, fontWeight: '600' },
  cancelBtn: { marginTop: 12, padding: 12, alignItems: 'center' },
  cancelText: { color: '#ef4444', fontWeight: '600' },
});
