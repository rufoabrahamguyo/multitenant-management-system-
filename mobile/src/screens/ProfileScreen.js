import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/AppShell';
import PropizyLogo from '../components/PropizyLogo';
import { colors, spacing, radius } from '../theme';

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();

  const rows = [
    { label: 'My Unit', icon: 'document-text-outline', onPress: () => navigation.navigate('Unit') },
    { label: 'Finance', icon: 'wallet-outline', onPress: () => navigation.navigate('Finance') },
    { label: 'Maintenance', icon: 'construct-outline', onPress: () => navigation.navigate('Maintenance') },
    { label: 'Community', icon: 'people-outline', onPress: () => navigation.navigate('Community') },
  ];

  return (
    <AppShell activeKey="profile">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.logoWrap}>
          <PropizyLogo />
        </View>

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

        {rows.map((row) => (
          <TouchableOpacity key={row.label} style={styles.row} onPress={row.onPress} activeOpacity={0.7}>
            <Ionicons name={row.icon} size={22} color={colors.textMuted} />
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Finance')}>
          <Text style={styles.ctaText}>Pay Rent</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  logoWrap: { alignItems: 'center', marginBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: colors.white, fontSize: 28, fontWeight: 'bold' },
  name: { fontSize: 22, fontWeight: 'bold', color: colors.text, marginTop: 16 },
  email: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  role: { fontSize: 12, color: colors.accent, marginTop: 8, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 14,
  },
  rowLabel: { flex: 1, fontSize: 16, color: colors.textMuted, fontWeight: '400' },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  ctaText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  logoutBtn: { marginTop: spacing.lg, padding: 16, alignItems: 'center' },
  logoutText: { color: colors.danger, fontWeight: '600', fontSize: 16 },
});
