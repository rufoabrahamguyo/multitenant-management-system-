import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppShell from '../components/AppShell';
import { colors, spacing, radius } from '../theme';

export default function CommunityScreen() {
  return (
    <AppShell activeKey="community">
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Ionicons name="people" size={40} color={colors.accent} />
        </View>
        <Text style={styles.title}>Community</Text>
        <Text style={styles.sub}>
          Notices, neighbour chat and building events will live here soon.
        </Text>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  sub: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
});
