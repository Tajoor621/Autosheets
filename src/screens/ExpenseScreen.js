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
import { formatCurrency } from '../utils/currency';
import GlassCard from '../components/GlassCard';

const CATEGORIES = ['Fuel', 'Maintenance', 'Tolls', 'Permits', 'Insurance', 'Other'];

export default function ExpenseScreen({ navigation }) {
  const [category, setCategory] = useState('Fuel');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [currency] = useState('AED');

  const handleSave = () => {
    if (!amount) {
      Alert.alert('Missing amount', 'Enter expense amount');
      return;
    }
    Alert.alert(
      'Expense Recorded',
      `${category}: ${formatCurrency(parseFloat(amount), currency)}\n${note || 'No note'}`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Record Expense</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.section}>CATEGORY</Text>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, category === c && styles.chipActive]}
              onPress={() => setCategory(c)}
            >
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <GlassCard style={{ marginTop: 16 }} padding={SPACING.lg}>
          <Text style={styles.label}>Amount (AED)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Note / Receipt Ref</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            value={note}
            onChangeText={setNote}
            placeholder="Optional description..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
          />
        </GlassCard>

        <TouchableOpacity style={styles.btn} onPress={handleSave}>
          <Ionicons name="save" size={22} color="#fff" />
          <Text style={styles.btnText}>Save Expense</Text>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.warning + '33',
    borderColor: COLORS.warning,
  },
  chipText: { color: COLORS.textSecondary, fontWeight: '600' },
  chipTextActive: { color: COLORS.warning },
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
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.warning,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    marginTop: 24,
    gap: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
