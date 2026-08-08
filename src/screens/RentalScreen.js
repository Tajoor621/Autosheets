import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../theme';
import { FLEET_ASSETS, CURRENCIES } from '../data/mockData';
import { formatCurrency, convertCurrency } from '../utils/currency';
import GlassCard from '../components/GlassCard';

export default function RentalScreen({ navigation }) {
  const available = FLEET_ASSETS.filter((v) => v.type === 'Rental');
  const [selected, setSelected] = useState(available[0]?.id || null);
  const [clientName, setClientName] = useState('');
  const [days, setDays] = useState('3');
  const [currency, setCurrency] = useState('USD');
  const [deposit, setDeposit] = useState('500');

  const vehicle = available.find((v) => v.id === selected);
  const dailyRate = vehicle?.dailyRate || 0;
  const total = dailyRate * (parseInt(days) || 0);
  const totalInSelected = convertCurrency(total, 'USD', currency);
  const depositInSelected = convertCurrency(parseFloat(deposit) || 0, 'USD', currency);

  const handleCreate = () => {
    if (!clientName.trim()) {
      Alert.alert('Missing info', 'Please enter client name');
      return;
    }
    Alert.alert(
      'Rental Agreement Created',
      `${vehicle.makeModel}\nClient: ${clientName}\nDuration: ${days} days\nTotal: ${formatCurrency(totalInSelected, currency)}\nDeposit held: ${formatCurrency(depositInSelected, currency)}`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quick Rental Agreement</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.section}>SELECT VEHICLE</Text>
        {available.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={[styles.vehicleCard, selected === v.id && styles.vehicleActive]}
            onPress={() => setSelected(v.id)}
          >
            <View style={[styles.statusDot, { backgroundColor: v.status === 'Available' ? COLORS.success : COLORS.warning }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.vehicleName}>{v.makeModel}</Text>
              <Text style={styles.vehicleMeta}>{v.plate} • {v.status}</Text>
            </View>
            <Text style={styles.rate}>{formatCurrency(v.dailyRate, 'USD')}/day</Text>
          </TouchableOpacity>
        ))}

        <GlassCard style={{ marginTop: 16 }} padding={SPACING.lg}>
          <Text style={styles.label}>Client Full Name</Text>
          <TextInput
            style={styles.input}
            value={clientName}
            onChangeText={setClientName}
            placeholder="Enter client name"
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={[styles.label, { marginTop: 14 }]}>Rental Days</Text>
          <TextInput
            style={styles.input}
            value={days}
            onChangeText={setDays}
            keyboardType="number-pad"
            placeholder="3"
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={[styles.label, { marginTop: 14 }]}>Security Deposit (USD)</Text>
          <TextInput
            style={styles.input}
            value={deposit}
            onChangeText={setDeposit}
            keyboardType="decimal-pad"
            placeholder="500"
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={[styles.label, { marginTop: 14 }]}>Invoice Currency</Text>
          <View style={styles.currencyRow}>
            {CURRENCIES.slice(0, 4).map((c) => (
              <TouchableOpacity
                key={c.code}
                style={[styles.curChip, currency === c.code && styles.curActive]}
                onPress={() => setCurrency(c.code)}
              >
                <Text style={[styles.curText, currency === c.code && styles.curTextActive]}>
                  {c.code}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </GlassCard>

        {/* Summary */}
        <GlassCard style={{ marginTop: 16 }} padding={SPACING.lg}>
          <Text style={styles.summaryTitle}>AGREEMENT SUMMARY</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Daily Rate</Text>
            <Text style={styles.summaryValue}>{formatCurrency(dailyRate, 'USD')}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Duration</Text>
            <Text style={styles.summaryValue}>{days} days</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatCurrency(total, 'USD')}</Text>
          </View>
          <View style={[styles.summaryRow, { marginTop: 8 }]}>
            <Text style={[styles.summaryLabel, { color: COLORS.accent }]}>Total ({currency})</Text>
            <Text style={[styles.summaryValue, { color: COLORS.accent, fontSize: 20 }]}>
              {formatCurrency(totalInSelected, currency)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Deposit Hold</Text>
            <Text style={styles.summaryValue}>{formatCurrency(depositInSelected, currency)}</Text>
          </View>
        </GlassCard>

        <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
          <Text style={styles.createBtnText}>Generate Agreement & Invoice</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: 12,
  },
  headerTitle: { ...TYPOGRAPHY.h3 },
  scroll: { padding: SPACING.md },
  section: {
    ...TYPOGRAPHY.caption,
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  vehicleActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '15',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  vehicleName: { ...TYPOGRAPHY.body, fontWeight: '600' },
  vehicleMeta: { ...TYPOGRAPHY.caption, marginTop: 2 },
  rate: { ...TYPOGRAPHY.body, fontWeight: '700', color: COLORS.primary },
  label: { ...TYPOGRAPHY.caption, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  currencyRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  curChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  curActive: {
    backgroundColor: COLORS.primary + '33',
    borderColor: COLORS.primary,
  },
  curText: { color: COLORS.textSecondary, fontWeight: '600' },
  curTextActive: { color: COLORS.primary },
  summaryTitle: {
    ...TYPOGRAPHY.caption,
    letterSpacing: 1,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  summaryValue: { ...TYPOGRAPHY.body, fontWeight: '600' },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    marginTop: 24,
    gap: 8,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
