import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Linking, RefreshControl,
  Modal, TouchableWithoutFeedback,
} from 'react-native';
import api from '../api/client';

export default function PaymentScreen() {
  const [payments, setPayments] = useState([]);
  const [lease, setLease] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [phoneLocal, setPhoneLocal] = useState('');
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
  }, []);

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

  const statusColor = { completed: '#16a34a', pending: '#ca8a04', failed: '#dc2626' };

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>Wallet Balance</Text>
          <Text style={styles.walletAmount}>KES {walletBalance.toLocaleString()}</Text>
          <Text style={styles.walletHint}>
            Extra payments are saved here and applied to upcoming rent automatically.
          </Text>
        </View>

        <TouchableOpacity style={styles.payRentBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.payRentText}>Pay Rent</Text>
        </TouchableOpacity>

        {transactions.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Wallet Activity</Text>
            {transactions.map((tx) => (
              <View key={tx.id} style={styles.card}>
                <View style={styles.row}>
                  <Text style={[styles.txAmount, { color: tx.transaction_type === 'credit' ? '#16a34a' : '#1e293b' }]}>
                    {tx.transaction_type === 'credit' ? '+' : '-'}KES {Number(tx.amount).toLocaleString()}
                  </Text>
                  <Text style={styles.meta}>Bal: {Number(tx.balance_after).toLocaleString()}</Text>
                </View>
                <Text style={styles.meta}>{tx.description}</Text>
                {tx.rent_month && <Text style={styles.meta}>Rent month: {tx.rent_month}</Text>}
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Payment History</Text>
        {payments.length === 0 && (
          <Text style={styles.empty}>No payments yet.</Text>
        )}
        {payments.map((p) => (
          <View key={p.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.payAmount}>KES {Number(p.amount).toLocaleString()}</Text>
              <Text style={[styles.status, { color: statusColor[p.status] }]}>{p.status}</Text>
            </View>
            <Text style={styles.meta}>
              {p.month_paid}
              {Number(p.wallet_applied) > 0 ? ` • Wallet: KES ${Number(p.wallet_applied).toLocaleString()}` : ''}
              {p.mpesa_receipt_number ? ` • ${p.mpesa_receipt_number}` : ''}
            </Text>
            {p.receipt_url && (
              <TouchableOpacity onPress={() => Linking.openURL(p.receipt_url)}>
                <Text style={styles.receiptLink}>Download Receipt</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => !loading && setModalVisible(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modal}>

                {/* Header */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Payment</Text>
                  <TouchableOpacity onPress={() => !loading && setModalVisible(false)}>
                    <Text style={styles.closeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Payment For */}
                <Text style={styles.fieldLabel}>Payment For</Text>
                <View style={styles.pickerBox}>
                  <Text style={styles.pickerValue}>Total Due Amount</Text>
                  <Text style={styles.chevron}>⌄</Text>
                </View>

                {/* Payment Using */}
                <Text style={styles.fieldLabel}>Payment Using</Text>
                <View style={styles.pickerBox}>
                  <Text style={styles.pickerValue}>M-Pesa</Text>
                  <Text style={styles.chevron}>⌄</Text>
                </View>

                {/* Phone with 254 prefix */}
                <View style={styles.phoneRow}>
                  <View style={styles.prefixBox}>
                    <Text style={styles.prefixText}>254</Text>
                    <Text style={styles.prefixChevron}>▾</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="Enter phone number"
                    placeholderTextColor="#b0b8c1"
                    value={phoneLocal}
                    onChangeText={setPhoneLocal}
                    keyboardType="phone-pad"
                    maxLength={9}
                  />
                </View>

                {/* Summary */}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Due</Text>
                  <Text style={styles.summaryValue}>{totalDue.toFixed(2)} KSh</Text>
                </View>
                <View style={[styles.summaryRow, { marginTop: 6 }]}>
                  <Text style={styles.summaryLabelBold}>Payment</Text>
                  <Text style={styles.summaryValueBold}>{totalDue.toFixed(2)} KSh</Text>
                </View>

                {/* Actions */}
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
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 20 },

  walletCard: { backgroundColor: '#0f172a', borderRadius: 16, padding: 20, marginBottom: 16 },
  walletLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  walletAmount: { fontSize: 32, fontWeight: '700', color: '#fff', marginTop: 4 },
  walletHint: { fontSize: 12, color: '#94a3b8', marginTop: 8, lineHeight: 18 },

  payRentBtn: {
    backgroundColor: '#5bbfb5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  payRentText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 12 },
  empty: { color: '#94a3b8', fontSize: 14, marginBottom: 16 },

  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txAmount: { fontSize: 16, fontWeight: '600' },
  payAmount: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  status: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  meta: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  receiptLink: { color: '#2563eb', fontSize: 13, marginTop: 8, fontWeight: '500' },

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 20,
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
  modalTitle: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  closeBtn: { fontSize: 20, color: '#9ca3af', padding: 4 },

  fieldLabel: { fontSize: 13, color: '#9ca3af', marginBottom: 8 },
  pickerBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  pickerValue: { fontSize: 16, color: '#1a1a1a' },
  chevron: { fontSize: 18, color: '#6b7280' },

  phoneRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 24,
  },
  prefixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    gap: 4,
  },
  prefixText: { fontSize: 16, color: '#1a1a1a', fontWeight: '500' },
  prefixChevron: { fontSize: 12, color: '#6b7280' },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryLabel: { fontSize: 14, color: '#6b7280' },
  summaryValue: { fontSize: 14, color: '#6b7280' },
  summaryLabelBold: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  summaryValueBold: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 24,
  },
  makePayBtn: {
    backgroundColor: '#5bbfb5',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minWidth: 150,
    alignItems: 'center',
  },
  makePayText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelText: { fontSize: 15, color: '#9ca3af', fontWeight: '500' },
});
