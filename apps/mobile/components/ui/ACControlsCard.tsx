import React from 'react';
import { View, StyleSheet } from 'react-native';
import Card from '@/components/ui/Card';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { ThemedText } from '@/components/ThemedText';
import { Design } from '@/constants/Design';

type Method = 'GET' | 'POST';

export default function ACControlsCard({
  onAction,
}: {
  onAction: (label: string, method: Method, path: string, body?: any) => void;
}) {
  const start = () => onAction('on', 'POST', '/ac/power', { action: 'on' });
  const stop = () => onAction('off', 'POST', '/ac/power', { action: 'off' });

  const quick = (minutes: number) => () =>
    onAction(`on ${minutes}m`, 'POST', '/ac/power', { action: 'on', minutes });

  return (
    <Card style={styles.card}>
      <ThemedText type="subtitle">AC Controls</ThemedText>
      <View style={styles.row}>
        <PrimaryButton title="Start" onPress={start} />
        <PrimaryButton title="Stop" onPress={stop} variant="danger" />
      </View>
      <ThemedText style={styles.helper}>Quick start</ThemedText>
      <View style={styles.quickRow}>
        <PrimaryButton title="15m" onPress={quick(15)} style={styles.smallBtn} />
        <PrimaryButton title="30m" onPress={quick(30)} style={styles.smallBtn} />
        <PrimaryButton title="1h" onPress={quick(60)} style={styles.smallBtn} />
        <PrimaryButton title="2h" onPress={quick(120)} style={styles.smallBtn} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Design.spacing.md },
  row: {
    flexDirection: 'row',
    gap: Design.spacing.sm,
  },
  helper: { color: Design.colors.textSecondary },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Design.spacing.sm },
  smallBtn: { paddingVertical: 10, paddingHorizontal: 18 },
});

