import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Design } from '@/constants/Design';

export default function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.pill}>
      <ThemedText style={styles.value}>{String(value)}</ThemedText>
      <ThemedText style={styles.label}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingVertical: Design.spacing.sm,
    paddingHorizontal: Design.spacing.md,
    borderRadius: Design.radii.pill,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  value: { color: 'white', fontWeight: '700' },
  label: { color: 'rgba(255,255,255,0.85)' },
});

