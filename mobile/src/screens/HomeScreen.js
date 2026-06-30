import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../api/client';

export default function HomeScreen() {
  const navigation = useNavigation();
  const [lease, setLease] = useState(null);

  useEffect(() => {
    api.get('/my-lease/').then(({ data }) => {
      const leases = data.results || data;
      if (leases.length > 0) setLease(leases[0]);
    }).catch(() => {});
  }, []);

  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + 1, 0);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.greeting}>Welcome back!</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Current Lease</Text>
        {lease ? (
          <>
            <Text style={styles.propertyName}>{lease.property_name}</Text>
            <Text style={styles.unitText}>Unit {lease.unit_number}</Text>
            <View style={styles.row}>
              <View>
                <Text style={styles.label}>Monthly Rent</Text>
                <Text style={styles.rentAmount}>KES {Number(lease.rent_amount).toLocaleString()}</Text>
              </View>
              <View>
                <Text style={styles.label}>Due Date</Text>
                <Text style={styles.dueDate}>{dueDate.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              </View>
            </View>
          </>
        ) : (
          <Text style={styles.noLease}>No active lease found.</Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.payButton}
        onPress={() => navigation.navigate('Pay')}
      >
        <Text style={styles.payButtonText}>Pay Rent via M-PESA</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 },
  cardLabel: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 },
  propertyName: { fontSize: 20, fontWeight: '600', color: '#1e293b', marginTop: 8 },
  unitText: { fontSize: 14, color: '#64748b', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  label: { fontSize: 12, color: '#94a3b8' },
  rentAmount: { fontSize: 22, fontWeight: 'bold', color: '#2563eb', marginTop: 4 },
  dueDate: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginTop: 4 },
  noLease: { color: '#94a3b8', marginTop: 12 },
  payButton: { backgroundColor: '#16a34a', borderRadius: 14, padding: 18, alignItems: 'center' },
  payButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
