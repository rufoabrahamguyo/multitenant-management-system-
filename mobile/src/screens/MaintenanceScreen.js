import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Modal,
  TouchableWithoutFeedback, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import AppShell from '../components/AppShell';
import { colors, spacing, radius } from '../theme';

const LOCATIONS = ['Unit Interior', 'Common Area - Stairways', 'Common Area - Lobby', 'Parking', 'Other'];
const CATEGORIES = ['Electrical', 'Plumbing', 'Appliance', 'Structural', 'Pest', 'Other'];

const statusStyles = {
  pending: { bg: '#FFF8E1', text: '#F9A825' },
  'in-progress': { bg: '#E3F2FD', text: '#1976D2' },
  resolved: { bg: colors.successSoft, text: colors.successText },
};

export default function MaintenanceScreen() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState('');

  const [location, setLocation] = useState(LOCATIONS[0]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const fetchRequests = async () => {
    const { data } = await api.get('/maintenance/');
    setRequests(data.results || data);
  };

  useEffect(() => { fetchRequests().catch(() => {}); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await fetchRequests(); } finally { setRefreshing(false); }
  };

  const resetForm = () => {
    setLocation(LOCATIONS[0]);
    setCategory(CATEGORIES[0]);
    setDescription('');
    setShowLocationPicker(false);
    setShowCategoryPicker(false);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/maintenance/', {
        issue_title: `${category}: ${location}`,
        issue_description: description.trim(),
      });
      setModalVisible(false);
      resetForm();
      await fetchRequests();
      Alert.alert('Submitted', 'Your maintenance ticket has been raised.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Submission failed.');
    } finally {
      setLoading(false);
    }
  };

  const q = query.trim().toLowerCase();
  const filtered = requests.filter((r) =>
    !q
    || String(r.issue_title || '').toLowerCase().includes(q)
    || String(r.issue_description || '').toLowerCase().includes(q)
    || String(r.status || '').toLowerCase().includes(q),
  );

  return (
    <AppShell activeKey="maintenance">
      <View style={styles.root}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <View style={styles.tools}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by tickets"
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
              />
            </View>
            <TouchableOpacity style={styles.toolBtn} onPress={() => Alert.alert('Calendar', 'Date filter coming soon.')}>
              <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toolBtn, styles.toolBtnPrimary]} onPress={() => setModalVisible(true)}>
              <Ionicons name="construct-outline" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>

          {filtered.length === 0 ? (
            <Text style={styles.empty}>No tickets yet. Tap the action button to raise one.</Text>
          ) : (
            filtered.map((req) => {
              const st = statusStyles[req.status] || statusStyles.pending;
              return (
                <View key={req.id} style={styles.row}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{req.issue_title}</Text>
                    <View style={[styles.badge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.badgeText, { color: st.text }]}>{req.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.rowDesc} numberOfLines={2}>{req.issue_description}</Text>
                  <Text style={styles.rowDate}>{new Date(req.created_at).toLocaleDateString()}</Text>
                </View>
              );
            })
          )}
        </ScrollView>

        <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => !loading && setModalVisible(false)}>
          <TouchableWithoutFeedback onPress={() => !loading && setModalVisible(false)}>
            <View style={styles.overlay}>
              <TouchableWithoutFeedback>
                <View style={styles.modal}>
                  <View style={styles.modalHeader}>
                    <View style={styles.modalTitleRow}>
                      <View style={styles.helpIcon}>
                        <Text style={styles.helpIconText}>?</Text>
                      </View>
                      <Text style={styles.modalTitle}>Raise A Ticket</Text>
                    </View>
                    <TouchableOpacity onPress={() => !loading && setModalVisible(false)}>
                      <Ionicons name="close" size={22} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.fieldLabel}>Location</Text>
                  <TouchableOpacity style={styles.pickerBox} onPress={() => { setShowLocationPicker((v) => !v); setShowCategoryPicker(false); }}>
                    <Text style={styles.pickerValue}>{location}</Text>
                    <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                  {showLocationPicker && (
                    <View style={styles.dropdown}>
                      {LOCATIONS.map((loc) => (
                        <TouchableOpacity key={loc} style={styles.dropdownItem} onPress={() => { setLocation(loc); setShowLocationPicker(false); }}>
                          <Text style={styles.dropdownText}>{loc}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={styles.fieldLabel}>Category</Text>
                  <TouchableOpacity style={styles.pickerBox} onPress={() => { setShowCategoryPicker((v) => !v); setShowLocationPicker(false); }}>
                    <Text style={styles.pickerValue}>{category}</Text>
                    <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                  {showCategoryPicker && (
                    <View style={styles.dropdown}>
                      {CATEGORIES.map((cat) => (
                        <TouchableOpacity key={cat} style={styles.dropdownItem} onPress={() => { setCategory(cat); setShowCategoryPicker(false); }}>
                          <Text style={styles.dropdownText}>{cat}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={styles.fieldLabel}>Description</Text>
                  <TextInput
                    style={styles.textarea}
                    placeholder="Description"
                    placeholderTextColor={colors.textMuted}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={4}
                  />

                  <TouchableOpacity style={styles.uploadBox} onPress={() => Alert.alert('Photos', 'Photo attachments coming soon.')}>
                    <Ionicons name="images-outline" size={32} color={colors.accentMuted} />
                  </TouchableOpacity>

                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.sendBtn, loading && { opacity: 0.7 }]}
                      onPress={handleSubmit}
                      disabled={loading}
                    >
                      {loading
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.sendText}>Send</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { if (!loading) { setModalVisible(false); resetForm(); } }}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  container: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },

  tools: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.lg },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 },
  toolBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnPrimary: { backgroundColor: colors.primary },

  empty: { color: colors.textMuted, fontSize: 14, marginTop: 32, textAlign: 'center', lineHeight: 20 },

  row: { paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  rowDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
  rowDate: { fontSize: 12, color: colors.textMuted, marginTop: 8 },

  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: colors.white,
    borderRadius: radius.xxl,
    padding: 24,
    width: '100%',
    maxWidth: 420,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  helpIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpIconText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },

  fieldLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 8 },
  pickerBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  pickerValue: { fontSize: 15, color: colors.text, flex: 1 },
  dropdown: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginTop: -10,
    marginBottom: 14,
    overflow: 'hidden',
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
  dropdownText: { fontSize: 14, color: colors.text },

  textarea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  uploadBox: {
    height: 88,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accentMuted,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 28,
    minWidth: 100,
    alignItems: 'center',
  },
  sendText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  cancelText: { fontSize: 15, color: colors.textMuted, fontWeight: '500' },
});
