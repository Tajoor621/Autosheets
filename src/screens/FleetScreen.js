import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../theme';
import { FLEET_ASSETS } from '../data/mockData';
import GlassCard from '../components/GlassCard';

const statusColor = {
  'On Trip': COLORS.primary,
  Rented: COLORS.secondary,
  Occupied: COLORS.accent,
  Available: COLORS.success,
  Idle: COLORS.warning,
};

export default function FleetScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fleet Assets</Text>
        <Text style={styles.sub}>{FLEET_ASSETS.length} units tracked</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {FLEET_ASSETS.map((asset) => (
          <GlassCard key={asset.id} style={{ marginBottom: 12 }} padding={SPACING.md}>
            <View style={styles.row}>
              <View style={[styles.badge, { backgroundColor: (statusColor[asset.status] || COLORS.textSecondary) + '22' }]}>
                <Text style={[styles.badgeText, { color: statusColor[asset.status] || COLORS.textSecondary }]}>
                  {asset.type}
                </Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: (statusColor[asset.status] || '#666') + '33' }]}>
                <Text style={[styles.statusText, { color: statusColor[asset.status] }]}>
                  {asset.status}
                </Text>
              </View>
            </View>

            <Text style={styles.name}>
              {asset.makeModel || asset.location}
            </Text>
            <Text style={styles.plate}>
              {asset.plate || asset.vehiclePlate || asset.id}
            </Text>

            {asset.driver && (
              <View style={styles.metaRow}>
                <Ionicons name="person" size={14} color={COLORS.textSecondary} />
                <Text style={styles.meta}>{asset.driver}</Text>
              </View>
            )}
            {asset.client && (
              <View style={styles.metaRow}>
                <Ionicons name="person" size={14} color={COLORS.textSecondary} />
                <Text style={styles.meta}>Client: {asset.client}</Text>
              </View>
            )}
            {asset.fuelLevel !== undefined && (
              <View style={styles.metaRow}>
                <Ionicons name="flash" size={14} color={COLORS.textSecondary} />
                <Text style={styles.meta}>Fuel {asset.fuelLevel}%</Text>
              </View>
            )}
            {asset.dailyRate && (
              <View style={styles.metaRow}>
                <Ionicons name="cash" size={14} color={COLORS.textSecondary} />
                <Text style={styles.meta}>${asset.dailyRate}/day</Text>
              </View>
            )}
            {asset.ratePerHour && (
              <View style={styles.metaRow}>
                <Ionicons name="time" size={14} color={COLORS.textSecondary} />
                <Text style={styles.meta}>د.إ{asset.ratePerHour}/hr</Text>
              </View>
            )}
          </GlassCard>
        ))}
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  name: { ...TYPOGRAPHY.h3, marginBottom: 2 },
  plate: { ...TYPOGRAPHY.caption, marginBottom: 8 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  meta: { ...TYPOGRAPHY.caption },
});
