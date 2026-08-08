import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../theme';
import { SHIFT_SUMMARY, TRANSACTIONS } from '../data/mockData';
import { formatCurrency } from '../utils/currency';
import GlassCard from '../components/GlassCard';

export default function ReportsScreen() {
  const [currency] = useState('USD');

  const handleExport = (type) => {
    Alert.alert(
      'Export Ready',
      `Shift report exported as ${type}.\nFile saved to device storage (offline).`,
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Financial Reports</Text>
        <Text style={styles.sub}>Shift {SHIFT_SUMMARY.shiftId}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* P&L */}
        <GlassCard padding={SPACING.lg}>
          <Text style={styles.sectionTitle}>P&L BY VERTICAL</Text>

          <View style={styles.plRow}>
            <View style={[styles.plBar, { backgroundColor: COLORS.primary, flex: 1.2 }]} />
            <Text style={styles.plLabel}>Rentals</Text>
            <Text style={styles.plValue}>
              {formatCurrency(SHIFT_SUMMARY.grossRevenue.rentals, currency)}
            </Text>
          </View>
          <View style={styles.plRow}>
            <View style={[styles.plBar, { backgroundColor: COLORS.accent, flex: 0.5 }]} />
            <Text style={styles.plLabel}>Parking</Text>
            <Text style={styles.plValue}>
              {formatCurrency(SHIFT_SUMMARY.grossRevenue.parking, currency)}
            </Text>
          </View>
          <View style={styles.plRow}>
            <View style={[styles.plBar, { backgroundColor: COLORS.secondary, flex: 2.1 }]} />
            <Text style={styles.plLabel}>Taxis</Text>
            <Text style={styles.plValue}>
              {formatCurrency(SHIFT_SUMMARY.grossRevenue.taxis, currency)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Gross Revenue</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(SHIFT_SUMMARY.totalGross, currency)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Expenses</Text>
            <Text style={[styles.totalValue, { color: COLORS.danger }]}>
              -{formatCurrency(SHIFT_SUMMARY.expenses, currency)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { fontWeight: '700' }]}>Net Profit</Text>
            <Text style={[styles.totalValue, { color: COLORS.success, fontSize: 22 }]}>
              {formatCurrency(SHIFT_SUMMARY.net, currency)}
            </Text>
          </View>
        </GlassCard>

        {/* Recent Transactions */}
        <Text style={[styles.sectionTitle, { marginTop: 24, marginLeft: 4 }]}>
          RECENT TRANSACTIONS
        </Text>
        {TRANSACTIONS.map((t) => (
          <GlassCard key={t.id} style={{ marginBottom: 8 }} padding={SPACING.md}>
            <View style={styles.txRow}>
              <View>
                <Text style={styles.txType}>{t.type}</Text>
                <Text style={styles.txId}>{t.id}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.txAmount}>
                  {formatCurrency(t.amount, t.currency)}
                </Text>
                <Text style={styles.txStatus}>{t.status}</Text>
              </View>
            </View>
          </GlassCard>
        ))}

        {/* Export */}
        <View style={styles.exportRow}>
          <TouchableOpacity style={styles.exportBtn} onPress={() => handleExport('JSON')}>
            <Ionicons name="code-slash" size={18} color={COLORS.primary} />
            <Text style={styles.exportText}>Export JSON</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportBtn} onPress={() => handleExport('CSV')}>
            <Ionicons name="document" size={18} color={COLORS.accent} />
            <Text style={styles.exportText}>Export CSV</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: 12,
  },
  headerTitle: { ...TYPOGRAPHY.h2 },
  sub: { ...TYPOGRAPHY.caption, marginTop: 2 },
  scroll: { padding: SPACING.md },
  sectionTitle: {
    ...TYPOGRAPHY.caption,
    letterSpacing: 1,
    marginBottom: 14,
  },
  plRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  plBar: {
    height: 8,
    borderRadius: 4,
    maxWidth: 120,
  },
  plLabel: { ...TYPOGRAPHY.body, flex: 1, color: COLORS.textSecondary },
  plValue: { ...TYPOGRAPHY.body, fontWeight: '700' },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 14,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  totalLabel: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  totalValue: { ...TYPOGRAPHY.body, fontWeight: '700' },
  txRow: { flexDirection: 'row', justifyContent: 'space-between' },
  txType: { ...TYPOGRAPHY.body, fontWeight: '600' },
  txId: { ...TYPOGRAPHY.caption },
  txAmount: { ...TYPOGRAPHY.body, fontWeight: '700' },
  txStatus: { ...TYPOGRAPHY.caption, color: COLORS.success },
  exportRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exportText: { color: COLORS.textPrimary, fontWeight: '600' },
});
