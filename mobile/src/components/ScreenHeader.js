import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme';

export default function ScreenHeader({ onMenuPress, onNotifyPress }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
      <TouchableOpacity onPress={onMenuPress} style={styles.iconBtn} hitSlop={12}>
        <Ionicons name="menu" size={26} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onNotifyPress} style={styles.bellWrap} hitSlop={8}>
        <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
  },
  iconBtn: { padding: 4 },
  bellWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
