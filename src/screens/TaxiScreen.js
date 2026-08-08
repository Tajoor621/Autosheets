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
import { FLEET_ASSETS } from '../data/mockData';
import { formatCurrency } from '../utils/currency';
import GlassCard from '../components/GlassCard';

export default function TaxiScreen({ navigation }) {
  const taxis = FLEET_ASSETS.filter((v) => v.type === 'Taxi');
  const [selected, setSelected] = useState(taxis[0]?.id);
  const [fare, setFare] = useState('75');
  const [currency] = useState('AED');

  const vehicle = taxis.find((v) => v.id === selected);
  const amount = parseFloat(fare) || 0;
  const driverShare = amount * ((vehicle?.commissionSplit?.driver || 60) / 100);
  const ownerShare = amount * ((vehicle?.commissionSplit?.owner || 40) / 100);

  const handleDispatch = () => {
    Alert.alert(
      'Taxi Fare Recorded',
      `Vehicle: ${vehicle.makeModel}\nDriver: ${vehicle.driver}\nFare: ${formatCurrency(amount, currency)}\nDriver share: ${formatCurrency(driverShare, currency)}\nOwner share: ${formatCurrency(ownerShare, currency)}`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dispatch Taxi Fare</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.section}>SELECT TAXI</Text>
        {taxis.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={[styles.card, selected === v.id && styles.cardActive]}
            onPress={() => setSelected(v.id)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{v.makeModel}</Text>
              <Text style={styles.meta}>{v.plate} • {v.driver}</Text>
              <Text style={styles.meta}>Status: {v.status} • Fuel {v.fuelLevel}%</Text>
            </View>
            <Text style={styles.split}>
              {v.commissionSplit.driver}/{v.commissionSplit.owner}
            </Text>
          </TouchableOpacity>
        ))}

        <GlassCard style={{ marginTop: 16 }} padding={SPACING.lg}>
          <Text style={styles.label}>Fare Amount (AED)</Text>
          <TextInput
            style={styles.input}
            value={fare}
            onChangeText={setFare}
            keyboardType="decimal-pad"
            placeholder="75.00"
            placeholderTextColor={COLORS.textSecondary}
          />
        </GlassCard>

        <GlassCard style={{ marginTop: 16 }} padding={SPACING.lg}>
          <Text style={styles.summaryTitle}>COMMISSION SPLIT</Text>
          <View style={styles.row}>
            <Text style={styles.metaLabel}>Driver ({vehicle?.commissionSplit.driver}%)</Text>
            <Text style={[styles.metaValue, { color: COLORS.success }]}>
              {formatCurrency(driverShare, currency)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.metaLabel}>Owner ({vehicle?.commissionSplit.owner}%)</Text>
            <Text style={[styles.metaValue, { color: COLORS.primary }]}>
              {formatCurrency(ownerShare, currency)}
            </Text>
          </View>
          <View style={[styles.row, { marginTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10 }]}>
            <Text style={[styles.metaLabel, { fontWeight: '700' }]}>Total Fare</Text>
            <Text style={[styles.metaValue, { fontSize: 20 }]}>
              {formatCurrency(amount, currency)}
            </Text>
          </View>
        </GlassCard>

        <TouchableOpacity style={styles.btn} onPress={handleDispatch}>
          <Ionicons name="checkmark-done" size={22} color="#fff" />
          <Text style={styles.btnText}>Record & Settle Fare</Text>
        </TouchableOpacity>
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
  section: { ...TYPOGRAPHY.caption, letterSpacing: 1, marginBottom: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardActive: {
    borderColor: COLORS.secondary,
    backgroundColor: COLORS.secondary + '15',
  },
  name: { ...TYPOGRAPHY.body, fontWeight: '600' },
  meta: { ...TYPOGRAPHY.caption, marginTop: 2 },
  split: { ...TYPOGRAPHY.caption, color: COLORS.secondary, fontWeight: '700' },
  label: { ...TYPOGRAPHY.caption, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 18,
    fontWeight: '600',
  },
  summaryTitle: { ...TYPOGRAPHY.caption, letterSpacing: 1, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  metaLabel: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  metaValue: { ...TYPOGRAPHY.body, fontWeight: '700' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    marginTop: 24,
    gap: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
