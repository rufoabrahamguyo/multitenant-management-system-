import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../api/client';
import AppShell from '../components/AppShell';
import { colors, spacing, radius, cardColors } from '../theme';

const PROPERTY_IMG =
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=60';

function PillButton({ label, onPress, variant = 'primary' }) {
  const isPrimary = variant === 'primary';
  return (
    <TouchableOpacity
      style={[styles.pillBtn, isPrimary ? styles.pillBtnPrimary : styles.pillBtnSoft]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.pillBtnText, isPrimary ? styles.pillBtnTextPrimary : styles.pillBtnTextSoft]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function FeatureCard({
  backgroundColor,
  bordered,
  title,
  subtitle,
  value,
  buttonLabel,
  onPress,
  children,
  emphasized,
}) {
  return (
    <View
      style={[
        styles.featureCard,
        { backgroundColor },
        bordered && styles.featureCardBordered,
        emphasized && styles.featureCardEmphasized,
      ]}
    >
      <View style={styles.featureTop}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.featureTitle}>{title}</Text>
          {subtitle ? <Text style={styles.featureSub}>{subtitle}</Text> : null}
        </View>
        {buttonLabel ? (
          <PillButton
            label={buttonLabel}
            onPress={onPress}
            variant={emphasized ? 'primary' : 'soft'}
          />
        ) : null}
      </View>
      {value != null ? <Text style={styles.featureValue}>{value}</Text> : null}
      {children}
    </View>
  );
}

function StatusChip({ label, tone }) {
  const toneStyles = {
    success: { bg: colors.successSoft, text: colors.successText, dot: colors.success },
    danger: { bg: colors.dangerSoft, text: colors.dangerText, dot: colors.danger },
    warning: { bg: colors.warningSoft, text: colors.warningText, dot: colors.warning },
    info: { bg: colors.accentSoft, text: colors.accentStrong, dot: colors.accent },
  };
  const t = toneStyles[tone] || toneStyles.info;
  return (
    <View style={[styles.chip, { backgroundColor: t.bg }]}>
      <View style={[styles.chipDot, { backgroundColor: t.dot }]} />
      <Text style={[styles.chipText, { color: t.text }]}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const [lease, setLease] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [openTickets, setOpenTickets] = useState(0);
  const [recentPaid, setRecentPaid] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [leaseRes, walletRes, maintRes, payRes] = await Promise.all([
        api.get('/my-lease/'),
        api.get('/payments/wallet/').catch(() => ({ data: { wallet: null } })),
        api.get('/maintenance/').catch(() => ({ data: [] })),
        api.get('/payments/').catch(() => ({ data: [] })),
      ]);
      const leases = leaseRes.data.results || leaseRes.data;
      setLease(leases.length > 0 ? leases[0] : null);
      setWallet(walletRes.data?.wallet || null);

      const tickets = maintRes.data.results || maintRes.data || [];
      setOpenTickets(tickets.filter((m) => m.status !== 'resolved').length);

      const payments = payRes.data.results || payRes.data || [];
      const monthKey = new Date().toISOString().slice(0, 7);
      setRecentPaid(payments.some((p) =>
        p.status === 'completed' && String(p.month_paid || p.created_at || '').startsWith(monthKey),
      ));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  const rent = lease ? Number(lease.rent_amount) : 0;
  const walletBal = wallet ? Number(wallet.balance) : 0;
  const leaseRange = lease
    ? `${lease.start_date || '-'} to ${lease.end_date || '-'}`
    : 'No active lease';

  // Propizy policy: rent must be paid by the 5th of each month
  const RENT_DUE_DAY = 5;
  const now = new Date();
  const dueDay = new Date(now.getFullYear(), now.getMonth(), RENT_DUE_DAY);
  const dueLabel = dueDay.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  const dayOfMonth = now.getDate();
  const isDueToday = dayOfMonth === RENT_DUE_DAY;
  const isOverdue = dayOfMonth > RENT_DUE_DAY;

  const chips = [];
  if (recentPaid) {
    chips.push({ key: 'paid', label: 'Rent Paid', tone: 'success' });
  } else if (rent > 0 && isOverdue) {
    chips.push({ key: 'due', label: 'Rent Overdue', tone: 'danger' });
  } else if (rent > 0 && isDueToday) {
    chips.push({ key: 'due', label: 'Payment Due Today', tone: 'danger' });
  } else if (rent > 0) {
    chips.push({ key: 'due', label: `Rent due by ${dueLabel}`, tone: 'warning' });
  }
  if (openTickets > 0) {
    chips.push({
      key: 'fix',
      label: openTickets === 1 ? 'Maintenance in Progress' : `${openTickets} open tickets`,
      tone: 'warning',
    });
  }
  if (lease) {
    chips.push({ key: 'in', label: 'Checked in', tone: 'success' });
  }

  return (
    <AppShell activeKey="home">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {chips.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            style={styles.chipScroll}
          >
            {chips.map((c) => (
              <StatusChip key={c.key} label={c.label} tone={c.tone} />
            ))}
          </ScrollView>
        ) : null}

        <FeatureCard
          backgroundColor={cardColors.amountDue}
          emphasized
          title="Amount Due"
          subtitle={
            lease
              ? (isOverdue && !recentPaid ? 'Overdue - was due by 5th' : `Due by ${dueLabel}`)
              : undefined
          }
          value={`${rent.toLocaleString('en-KE', { minimumFractionDigits: 2 })} KSh`}
          buttonLabel="Pay Now"
          onPress={() => navigation.navigate('Finance')}
        />

        <FeatureCard
          backgroundColor={cardColors.booking}
          bordered
          title="Current Booking"
          buttonLabel="View Unit"
          onPress={() => navigation.navigate('Unit')}
        >
          <Text style={styles.featureFooter}>{leaseRange}</Text>
        </FeatureCard>

        <FeatureCard
          backgroundColor={cardColors.wallet}
          bordered
          title="Wallet"
          value={`${walletBal.toLocaleString('en-KE', { minimumFractionDigits: 2 })} KSh`}
          buttonLabel="View"
          onPress={() => navigation.navigate('Finance')}
        />

        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <Image source={{ uri: PROPERTY_IMG }} style={styles.thumb} />
            <View style={styles.summaryMeta}>
              <Text style={styles.propertyName} numberOfLines={2}>
                {lease?.property_name || 'No property'}
              </Text>
              {lease ? (
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>Checked in</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.summaryBottom}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Unit</Text>
              <Text style={styles.metaValue}>{lease?.unit_number || '-'}</Text>
            </View>
            <View style={[styles.metaCol, { alignItems: 'flex-end' }]}>
              <Text style={styles.metaLabel}>Occupancy</Text>
              <Text style={styles.metaValueMuted}>
                {lease?.category_name || 'Single Occupancy'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },

  chipScroll: { marginBottom: spacing.md, marginHorizontal: -spacing.xl },
  chipRow: { paddingHorizontal: spacing.xl, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    gap: 6,
  },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 12, fontWeight: '600' },

  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  thumb: { width: 72, height: 72, borderRadius: radius.lg },
  summaryMeta: { flex: 1, gap: 8 },
  propertyName: { fontSize: 16, fontWeight: '600', color: colors.text, lineHeight: 22 },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusText: { fontSize: 11, fontWeight: '600', color: colors.successText },
  summaryBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  metaCol: { flex: 1 },
  metaLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  metaValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  metaValueMuted: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },

  featureCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.md,
    minHeight: 112,
    justifyContent: 'space-between',
  },
  featureCardBordered: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureCardEmphasized: {
    borderWidth: 1,
    borderColor: colors.accentMuted,
  },
  featureTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  featureTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  featureSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  featureValue: { fontSize: 28, fontWeight: '700', color: colors.text, marginTop: 14 },
  featureFooter: { fontSize: 14, color: colors.textSecondary, marginTop: 16 },

  pillBtn: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillBtnPrimary: { backgroundColor: colors.accentStrong },
  pillBtnSoft: { backgroundColor: colors.primarySoft },
  pillBtnText: { fontSize: 12, fontWeight: '600' },
  pillBtnTextPrimary: { color: colors.white },
  pillBtnTextSoft: { color: colors.primary },
});
