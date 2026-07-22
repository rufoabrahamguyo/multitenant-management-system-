import React from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PropizyLogo from './PropizyLogo';
import { colors, spacing, radius } from '../theme';

const MENU_ITEMS = [
  { key: 'home', label: 'My Home', icon: 'grid-outline', screen: 'Home' },
  { key: 'profile', label: 'My Profile', icon: 'person-outline', screen: 'Me' },
  { key: 'unit', label: 'My Unit', icon: 'document-text-outline', screen: 'Unit' },
  { key: 'finance', label: 'Finance', icon: 'wallet-outline', screen: 'Finance' },
  { key: 'maintenance', label: 'Maintenance', icon: 'construct-outline', screen: 'Maintenance' },
  { key: 'community', label: 'Community', icon: 'people-outline', screen: 'Community' },
];

export default function SideMenu({ visible, onClose, navigation, onLogout, activeKey }) {
  const insets = useSafeAreaInsets();

  const go = (screen) => {
    onClose();
    if (screen && navigation) {
      navigation.navigate(screen);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.dim} onPress={onClose} />
        <View style={[styles.panel, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.header}>
            <PropizyLogo size="md" variant="dark" />
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Tenant Portal</Text>
            <Text style={styles.bannerSub}>Manage your home, payments & requests</Text>
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {MENU_ITEMS.map((item) => {
              const active = activeKey === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => go(item.screen)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.icon}
                    size={22}
                    color={active ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>{item.label}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={active ? colors.blue : colors.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity style={styles.cta} onPress={() => go('Finance')}>
            <Text style={styles.ctaText}>Pay Rent</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logout} onPress={() => { onClose(); onLogout?.(); }}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  dim: { flex: 1, backgroundColor: colors.overlay },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '82%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  banner: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.xxl,
    overflow: 'hidden',
  },
  bannerTitle: { color: colors.white, fontSize: 16, fontWeight: '700' },
  bannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 6 },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    marginBottom: 4,
    gap: spacing.md,
  },
  rowActive: { backgroundColor: colors.accentSoft },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '400', color: colors.textMuted },
  rowLabelActive: { color: colors.text, fontWeight: '500' },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  ctaText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  logout: { alignItems: 'center', paddingVertical: spacing.lg },
  logoutText: { color: colors.danger, fontWeight: '600', fontSize: 15 },
});
