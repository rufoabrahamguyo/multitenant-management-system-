import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.first_name?.[0] || user?.username?.[0] || 'T').toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{user?.first_name || user?.username}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.role}>Tenant</Text>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  name: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginTop: 16 },
  email: { fontSize: 14, color: '#64748b', marginTop: 4 },
  role: { fontSize: 12, color: '#2563eb', marginTop: 8, fontWeight: '600' },
  logoutBtn: { marginTop: 32, backgroundColor: '#fef2f2', borderRadius: 12, padding: 16, alignItems: 'center' },
  logoutText: { color: '#dc2626', fontWeight: '600', fontSize: 16 },
});
