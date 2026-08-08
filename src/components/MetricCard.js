import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../theme';
import GlassCard from './GlassCard';

export default function MetricCard({ title, value, subtitle, accentColor = COLORS.primary, icon }) {
  return (
    <GlassCard style={styles.container} padding={SPACING.md}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {icon && <View style={[styles.iconWrap, { backgroundColor: accentColor + '22' }]}>{icon}</View>}
      </View>
      <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 150,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    ...TYPOGRAPHY.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    marginTop: 4,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
