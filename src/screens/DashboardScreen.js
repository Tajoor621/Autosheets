import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../theme';
import { SHIFT_SUMMARY, CURRENCIES } from '../data/mockData';
import { formatCurrency } from '../utils/currency';
import MetricCard from '../components/MetricCard';
import ShortcutButton from '../components/ShortcutButton';
import GlassCard from '../components/GlassCard';

const ALL_SHORTCUTS = [
  {
    key: 'rental',
    title: 'Quick Rental',
    color: COLORS.primary,
    icon: <Ionicons name="document-text" size={22} color={COLORS.primary} />,
    route: 'Rental',
    roles: ['owner', 'rental'],
  },
  {
    key: 'parking',
    title: 'Log Parking',
    color: COLORS.accent,
    icon: <MaterialCommunityIcons name="parking" size={22} color={COLORS.accent} />,
    route: 'Parking',
    roles: ['owner', 'parking'],
  },
  {
    key: 'taxi',
    title: 'Dispatch Taxi',
    color: COLORS.secondary,
    icon: <Ionicons name="car-sport" size={22} color={COLORS.secondary} />,
    route: 'Taxi',
    roles: ['owner', 'dispatcher'],
  },
  {
    key: 'expense',
    title: 'Record Expense',
    color: COLORS.warning,
    icon: <Ionicons name="receipt" size={22} color={COLORS.warning} />,
    route: 'Expense',
    roles: ['owner', 'accountant', 'rental', 'parking', 'dispatcher'],
  },
];

export default function DashboardScreen({ navigation, route }) {
  const [currency, setCurrency] = useState('USD');
  const role = route?.params?.role || 'owner';

  const cycleCurrency = () => {
    const idx = CURRENCIES.findIndex((c) => c.code === currency);
    const next = CURRENCIES[(idx + 1) % CURRENCIES.length];
    setCurrency(next.code);
  };

  const totalRevenue = SHIFT_SUMMARY.totalGross;
  const visibleShortcuts = ALL_SHORTCUTS.filter((s) => s.roles.includes(role));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Command Center</Text>
          <Text style={styles.roleBadge}>{role.toUpperCase()} • LIVE</Text>
        </View>
        <TouchableOpacity style={styles.currencyBtn} onPress={cycleCurrency}>
          <Text style={styles.currencyText}>{currency}</Text>
          <Ionicons name="swap-horizontal" size={16} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Revenue Hero */}
        <GlassCard style={styles.hero} padding={SPACING.lg}>
          <Text style={styles.heroLabel}>TODAY'S GROSS REVENUE</Text>
          <Text style={styles.heroValue}>
            {formatCurrency(totalRevenue, currency)}
          </Text>
          <View style={styles.heroBreakdown}>
            <View style={styles.breakItem}>
              <View style={[styles.dot, { backgroundColor: COLORS.primary }]} />
              <Text style={styles.breakText}>
                Rentals {formatCurrency(SHIFT_SUMMARY.grossRevenue.rentals, currency)}
              </Text>
            </View>
            <View style={styles.breakItem}>
              <View style={[styles.dot, { backgroundColor: COLORS.accent }]} />
              <Text style={styles.breakText}>
                Parking {formatCurrency(SHIFT_SUMMARY.grossRevenue.parking, currency)}
              </Text>
            </View>
            <View style={styles.breakItem}>
              <View style={[styles.dot, { backgroundColor: COLORS.secondary }]} />
              <Text style={styles.breakText}>
                Taxis {formatCurrency(SHIFT_SUMMARY.grossRevenue.taxis, currency)}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* Metrics Row */}
        <View style={styles.metricsRow}>
          <MetricCard
            title="Utilization"
            value={`${SHIFT_SUMMARY.utilization}%`}
            subtitle="Fleet active"
            accentColor={COLORS.success}
            icon={<Ionicons name="speedometer" size={16} color={COLORS.success} />}
          />
          <MetricCard
            title="Active Rentals"
            value={String(SHIFT_SUMMARY.activeRentals)}
            subtitle="Out now"
            accentColor={COLORS.primary}
            icon={<Ionicons name="car" size={16} color={COLORS.primary} />}
          />
        </View>
        <View style={styles.metricsRow}>
          <MetricCard
            title="Parking Open"
            value={`${SHIFT_SUMMARY.openParking}/${SHIFT_SUMMARY.totalParkingSlots}`}
            subtitle="Slots free"
            accentColor={COLORS.accent}
            icon={<MaterialCommunityIcons name="parking" size={16} color={COLORS.accent} />}
          />
          <MetricCard
            title="Unsettled"
            value={String(SHIFT_SUMMARY.unsettledFares)}
            subtitle="Taxi fares"
            accentColor={COLORS.warning}
            icon={<Ionicons name="alert-circle" size={16} color={COLORS.warning} />}
          />
        </View>

        {/* Shortcuts */}
        <Text style={styles.sectionTitle}>INSTANT ACTIONS</Text>
        <View style={styles.shortcuts}>
          {visibleShortcuts.map((s) => (
            <ShortcutButton
              key={s.key}
              title={s.title}
              color={s.color}
              icon={s.icon}
              onPress={() => navigation.navigate(s.route)}
            />
          ))}
        </View>

        {/* Quick Stats Footer */}
        <GlassCard style={{ marginTop: 8 }} padding={SPACING.md}>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Net after expenses</Text>
            <Text style={[styles.footerValue, { color: COLORS.success }]}>
              {formatCurrency(SHIFT_SUMMARY.net, currency)}
            </Text>
          </View>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Shift ID</Text>
            <Text style={styles.footerValue}>{SHIFT_SUMMARY.shiftId}</Text>
          </View>
        </GlassCard>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: 12,
  },
  greeting: {
    ...TYPOGRAPHY.h2,
  },
  roleBadge: {
    ...TYPOGRAPHY.caption,
    color: COLORS.accent,
    marginTop: 2,
    letterSpacing: 1,
  },
  currencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  currencyText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  scroll: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 20,
  },
  hero: {
    marginBottom: SPACING.md,
  },
  heroLabel: {
    ...TYPOGRAPHY.caption,
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroValue: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 14,
  },
  heroBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  breakItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  sectionTitle: {
    ...TYPOGRAPHY.caption,
    letterSpacing: 1.5,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
  },
  shortcuts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  footerLabel: {
    ...TYPOGRAPHY.caption,
  },
  footerValue: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
  },
});
