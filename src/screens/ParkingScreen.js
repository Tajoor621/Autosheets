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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../theme';
import { formatCurrency } from '../utils/currency';
import GlassCard from '../components/GlassCard';

export default function ParkingScreen({ navigation }) {
  const [plate, setPlate] = useState('');
  const [tariff, setTariff] = useState('hourly');
  const [hours, setHours] = useState('2');
  const rateHourly = 8; // AED
  const rateFlat = 45;

  const amount =
    tariff === 'hourly'
      ? rateHourly * (parseFloat(hours) || 0)
      : rateFlat;

  const handleLog = () => {
    if (!plate.trim()) {
      Alert.alert('Missing plate', 'Enter vehicle plate number');
      return;
    }
    Alert.alert(
      'Parking Ticket Logged',
      `Plate: ${plate}\nTariff: ${tariff}\nAmount: ${formatCurrency(amount, 'AED')}\nEntry time recorded.`,
      [{ text: 'Done', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Log Parking Ticket</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <GlassCard padding={SPACING.lg}>
          <Text style={styles.label}>Vehicle Plate</Text>
          <TextInput
            style={styles.input}
            value={plate}
            onChangeText={setPlate}
            placeholder="e.g. DXB-P-1122"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="characters"
          />

          <Text style={[styles.label, { marginTop: 18 }]}>Tariff Type</Text>
          <View style={styles.tariffRow}>
            <TouchableOpacity
              style={[styles.tariffBtn, tariff === 'hourly' && styles.tariffActive]}
              onPress={() => setTariff('hourly')}
            >
              <MaterialCommunityIcons
                name="clock-outline"
                size={20}
                color={tariff === 'hourly' ? COLORS.accent : COLORS.textSecondary}
              />
              <Text style={[styles.tariffText, tariff === 'hourly' && { color: COLORS.accent }]}>
                Hourly (د.إ{rateHourly}/hr)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tariffBtn, tariff === 'flat' && styles.tariffActive]}
              onPress={() => setTariff('flat')}
            >
              <Ionicons
                name="sunny"
                size={20}
                color={tariff === 'flat' ? COLORS.accent : COLORS.textSecondary}
              />
              <Text style={[styles.tariffText, tariff === 'flat' && { color: COLORS.accent }]}>
                Flat Day (د.إ{rateFlat})
              </Text>
            </TouchableOpacity>
          </View>

          {tariff === 'hourly' && (
            <>
              <Text style={[styles.label, { marginTop: 18 }]}>Hours</Text>
              <TextInput
                style={styles.input}
                value={hours}
                onChangeText={setHours}
                keyboardType="decimal-pad"
                placeholder="2"
                placeholderTextColor={COLORS.textSecondary}
              />
            </>
          )}
        </GlassCard>

        <GlassCard style={{ marginTop: 16 }} padding={SPACING.lg}>
          <Text style={styles.summaryTitle}>TICKET PREVIEW</Text>
          <View style={styles.row}>
            <Text style={styles.meta}>Entry Time</Text>
            <Text style={styles.metaValue}>Now (auto)</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.meta}>Estimated Amount</Text>
            <Text style={[styles.metaValue, { color: COLORS.accent, fontSize: 20 }]}>
              {formatCurrency(amount, 'AED')}
            </Text>
          </View>
          <Text style={styles.note}>
            Overstay penalties auto-apply after 24h. Exit scan will finalize.
          </Text>
        </GlassCard>

        <TouchableOpacity style={styles.btn} onPress={handleLog}>
          <MaterialCommunityIcons name="ticket-confirmation" size={22} color="#fff" />
          <Text style={styles.btnText}>Issue Parking Ticket</Text>
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
  tariffRow: { gap: 10 },
  tariffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 8,
  },
  tariffActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '15',
  },
  tariffText: { color: COLORS.textSecondary, fontWeight: '600' },
  summaryTitle: { ...TYPOGRAPHY.caption, letterSpacing: 1, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  meta: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  metaValue: { ...TYPOGRAPHY.body, fontWeight: '600' },
  note: { ...TYPOGRAPHY.caption, marginTop: 12, opacity: 0.7 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    marginTop: 24,
    gap: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
