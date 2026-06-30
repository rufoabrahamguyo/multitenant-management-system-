import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import api from '../api/client';

const statusColors = { pending: '#ca8a04', 'in-progress': '#2563eb', resolved: '#16a34a' };

export default function MaintenanceScreen() {
  const [requests, setRequests] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchRequests = () => {
    api.get('/maintenance/').then(({ data }) => setRequests(data.results || data));
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleSubmit = async () => {
    if (!title || !description) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/maintenance/', { issue_title: title, issue_description: description });
      setTitle('');
      setDescription('');
      fetchRequests();
      Alert.alert('Submitted', 'Your maintenance request has been submitted.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Submission failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.formTitle}>New Request</Text>
        <TextInput
          style={styles.input}
          placeholder="Issue Title"
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Request</Text>}
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Previous Requests</Text>
      {requests.map((req) => (
        <View key={req.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{req.issue_title}</Text>
            <Text style={[styles.badge, { color: statusColors[req.status] }]}>{req.status}</Text>
          </View>
          <Text style={styles.cardDesc}>{req.issue_description}</Text>
          <Text style={styles.cardDate}>{new Date(req.created_at).toLocaleDateString()}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  form: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 24 },
  formTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 15 },
  textarea: { height: 100, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: '#2563eb', borderRadius: 10, padding: 14, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1e293b', flex: 1 },
  badge: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  cardDesc: { fontSize: 13, color: '#64748b', marginTop: 6 },
  cardDate: { fontSize: 11, color: '#94a3b8', marginTop: 8 },
});
