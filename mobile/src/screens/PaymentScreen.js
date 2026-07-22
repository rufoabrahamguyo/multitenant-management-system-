import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Linking, RefreshControl,
  Modal, TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import AppShell from '../components/AppShell';
import { colors, spacing, radius } from '../theme';

const TABS = ['Invoices', 'Payments', 'Refunds'];

export default function PaymentScreen() {
  const [payments, setPayments] = useState([]);
  const [lease, setLease] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [phoneLocal, setPhoneLocal] = useState('');
  const [tab, setTab] = useState('Invoices');
  const [query, setQuery] = useState('');
  const pollingRef = useRef(null);

  const fetchData = useCallback(async () => {
    const [paymentsRes, leaseRes, walletRes] = await Promise.all([
      api.get('/payments/'),
      api.get('/my-lease/'),
      api.get('/payments/wallet/'),
    ]);
    setPayments(paymentsRes.data.results || paymentsRes.data);
    const leases = leaseRes.data.results || leaseRes.data;
    const activeLease = leases.length > 0 ? leases[0] : null;
    setLease(activeLease);
    if (activeLease?.tenant_phone) {
      setPhoneLocal((prev) => prev || activeLease.tenant_phone.replace(/^254/, ''));
    }
    setWallet(walletRes.data.wallet);
    setTransactions(walletRes.data.transactions || []);
  }, []);

  useEffect(() => {
    fetchData().catch(() => {});
    return () => clearInterval(pollingRef.current);
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await fetchData(); } finally { setRefreshing(false); }
  };

  const pollPaymentStatus = (paymentId) => {
    pollingRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/payments/payment-status/${paymentId}/`);
        if (data.status !== 'pending') {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          fetchData();
          Alert.alert(
            data.status === 'completed' ? 'Payment Successful' : 'Payment Failed',
            data.status === 'completed'
              ? `Receipt: ${data.mpesa_receipt_number || 'Generated'}`
              : 'Please try again.',
          );
        }
      } catch {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }, 3000);
    setTimeout(() => {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }, 60000);
  };

  const totalDue = lease ? Number(lease.rent_amount) : 0;
  const walletBalance = wallet ? Number(wallet.balance) : 0;

  const handlePay = async () => {
    if (!lease) { Alert.alert('Error', 'No active lease found.'); return; }
    if (!phoneLocal.trim()) { Alert.alert('Error', 'Enter your M-PESA phone number.'); return; }
    if (totalDue <= 0) { Alert.alert('Error', 'No amount due.'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/payments/initiate/', {
        amount: totalDue.toFixed(2),
        phone_number: `254${phoneLocal.trim()}`,
        lease_id: lease.id,
      });
      setModalVisible(false);
      if (data.simulated) {
        Alert.alert('Payment Complete', data.message || 'Payment recorded successfully.');
        fetchData();
      } else {
        Alert.alert('STK Push Sent', data.message || 'Check your phone for the M-PESA prompt.');
        pollPaymentStatus(data.payment_id);
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Payment failed.');
    } finally {
      setLoading(false);
    }
  };

  const q = query.trim().toLowerCase();

  const invoiceRows = payments
    .filter((p) => !q || String(p.month_paid || '').toLowerCase().includes(q) || String(p.amount).includes(q))
    .map((p) => ({
      id: `inv-${p.id}`,
      title: p.month_paid ? `${p.month_paid} Rent` : 'Rent invoice',
      amount: Number(p.amount),
      status: p.status === 'completed' ? 'Paid' : p.status,
      date: p.created_at ? p.created_at.slice(0, 10) : '',
      receiptUrl: p.receipt_url,
    }));

  const paymentRows = payments
    .filter((p) => !q || String(p.mpesa_receipt_number || '').toLowerCase().includes(q))
    .map((p) => ({
      id: `pay-${p.id}`,
      title: p.mpesa_receipt_number || `Payment #${p.id}`,
      amount: Number(p.amount),
      status: p.status === 'completed' ? 'Paid' : p.status,
      date: p.created_at ? p.created_at.slice(0, 10) : '',
      receiptUrl: p.receipt_url,
    }));

  const refundRows = transactions
    .filter((tx) => tx.transaction_type === 'debit' || /refund/i.test(tx.description || ''))
    .filter((tx) => !q || String(tx.description || '').toLowerCase().includes(q))
    .map((tx) => ({
      id: `rf-${tx.id}`,
      title: tx.description || 'Wallet debit',
      amount: Number(tx.amount),
      status: 'Processed',
      date: tx.created_at ? String(tx.created_at).slice(0, 10) : '',
    }));

  const rows = tab === 'Invoices' ? invoiceRows : tab === 'Payments' ? paymentRows : refundRows;

  return (
    <AppShell activeKey="finance">
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
              placeholder="Search by invoices"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
            />
          </View>
          <TouchableOpacity style={styles.toolBtn} onPress={() => Alert.alert('Calendar', 'Date filter coming soon.')}>
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toolBtn, styles.toolBtnPrimary]} onPress={() => setModalVisible(true)}>
            <Ionicons name="download-outline" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          {TABS.map((t) => {
            const active = tab === t;
            return (
              <TouchableOpacity key={t} onPress={() => setTab(t)} style={styles.tab}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t}</Text>
                {active ? <View style={styles.tabUnderline} /> : <View style={styles.tabUnderlineSpacer} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {tab === 'Invoices' && (
          <TouchableOpacity style={styles.payBanner} onPress={() => setModalVisible(true)}>
            <View>
              <Text style={styles.payBannerLabel}>Amount due</Text>
              <Text style={styles.payBannerAmount}>
                {totalDue.toLocaleString('en-KE', { minimumFractionDigits: 2 })} KSh
              </Text>
            </View>
            <Text style={styles.payBannerCta}>Pay · Wallet {walletBalance.toLocaleString()}</Text>
          </TouchableOpacity>
        )}

        {rows.length === 0 ? (
          <Text style={styles.empty}>
            {tab === 'Refunds' ? 'No refunds yet.' : `No ${tab.toLowerCase()} found.`}
          </Text>
        ) : (
          rows.map((row) => (
            <View key={row.id} style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{row.title}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{row.status}</Text>
                  </View>
                  <TouchableOpacity hitSlop={8}>
                    <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <View style={styles.rowBottom}>
                  <Text style={styles.rowAmount}>{row.amount.toLocaleString()}</Text>
                  <Text style={styles.rowDate}>{row.date}</Text>
                </View>
                {row.receiptUrl ? (
                  <TouchableOpacity onPress={() => Linking.openURL(row.receiptUrl)}>
                    <Text style={styles.receiptLink}>Download receipt</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => !loading && setModalVisible(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modal}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Payment</Text>
                  <TouchableOpacity onPress={() => !loading && setModalVisible(false)}>
                    <Ionicons name="close" size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>Payment For</Text>
                <View style={styles.pickerBox}>
                  <Text style={styles.pickerValue}>Total Due Amount</Text>
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                </View>

                <Text style={styles.fieldLabel}>Payment Using</Text>
                <View style={styles.pickerBox}>
                  <Text style={styles.pickerValue}>M-Pesa</Text>
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                </View>

                <View style={styles.phoneRow}>
                  <View style={styles.prefixBox}>
                    <Text style={styles.prefixText}>254</Text>
                    <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="Enter phone number"
                    placeholderTextColor={colors.textMuted}
                    value={phoneLocal}
                    onChangeText={setPhoneLocal}
                    keyboardType="phone-pad"
                    maxLength={9}
                  />
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Due</Text>
                  <Text style={styles.summaryValue}>{totalDue.toFixed(2)} KSh</Text>
                </View>
                <View style={[styles.summaryRow, { marginTop: 6 }]}>
                  <Text style={styles.summaryLabelBold}>Payment</Text>
                  <Text style={styles.summaryValueBold}>{totalDue.toFixed(2)} KSh</Text>
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.makePayBtn, loading && { opacity: 0.7 }]}
                    onPress={handlePay}
                    disabled={loading}
                  >
                    {loading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.makePayText}>Make Payment</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => !loading && setModalVisible(false)} disabled={loading}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
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

  tabs: { flexDirection: 'row', gap: 24, marginBottom: spacing.xl },
  tab: { paddingBottom: 2 },
  tabText: { fontSize: 15, color: colors.textMuted, fontWeight: '500' },
  tabTextActive: { color: colors.accent, fontWeight: '600' },
  tabUnderline: { height: 2, backgroundColor: colors.accent, marginTop: 6, borderRadius: 1 },
  tabUnderlineSpacer: { height: 2, marginTop: 6 },

  payBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  payBannerLabel: { fontSize: 12, color: colors.textSecondary },
  payBannerAmount: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 2 },
  payBannerCta: { fontSize: 13, fontWeight: '600', color: colors.accent },

  empty: { color: colors.textMuted, fontSize: 14, marginTop: 24, textAlign: 'center' },

  row: { paddingVertical: 16 },
  rowLeft: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  badge: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: colors.accent, textTransform: 'capitalize' },
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  rowAmount: { fontSize: 14, color: colors.textSecondary },
  rowDate: { fontSize: 13, color: colors.textMuted },
  receiptLink: { color: colors.accent, fontSize: 13, marginTop: 8, fontWeight: '500' },

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
    marginBottom: 24,
  },
  modalTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  fieldLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 8 },
  pickerBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  pickerValue: { fontSize: 16, color: colors.text },
  phoneRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: 24,
  },
  prefixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: '#f9fafb',
    gap: 4,
  },
  prefixText: { fontSize: 16, color: colors.text, fontWeight: '500' },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryLabel: { fontSize: 14, color: colors.textSecondary },
  summaryValue: { fontSize: 14, color: colors.textSecondary },
  summaryLabelBold: { fontSize: 18, fontWeight: '700', color: colors.text },
  summaryValueBold: { fontSize: 18, fontWeight: '700', color: colors.text },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 24,
  },
  makePayBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minWidth: 150,
    alignItems: 'center',
  },
  makePayText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  cancelText: { fontSize: 15, color: colors.textMuted, fontWeight: '500' },
});
