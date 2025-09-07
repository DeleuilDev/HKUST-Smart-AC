import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Switch, Modal, TextInput, Pressable } from 'react-native';
import Card from '@/components/ui/Card';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { ThemedText } from '@/components/ThemedText';
import { Design } from '@/constants/Design';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import IconButton from '@/components/ui/IconButton';

type Method = 'GET' | 'POST';

export default function ACControlsCard({
  onAction,
  powerState,
  disabled = false,
}: {
  onAction: (label: string, method: Method, path: string, body?: any) => void;
  powerState?: 'on' | 'off';
  disabled?: boolean;
}) {
  const [isOn, setIsOn] = useState<boolean>(powerState === 'on');
  // Sync local switch state when server-provided powerState updates
  useEffect(() => {
    if (powerState === 'on') setIsOn(true);
    else if (powerState === 'off') setIsOn(false);
  }, [powerState]);
  const [showCustom, setShowCustom] = useState(false);
  const [customMinutes, setCustomMinutes] = useState<number>(30);
  // Simplified custom timer: duration only (end time removed)

  const statusColor = isOn ? Design.colors.statusPositive : Design.colors.statusNegative;
  const statusLabel = isOn ? 'On' : 'Off';

  const handleToggle = async (next: boolean) => {
    if (disabled) return;
    setIsOn(next);
    try {
      await Haptics.selectionAsync();
    } catch {}
    const action = next ? 'on' : 'off';
    onAction(action, 'POST', '/ac/power', { action });
  };

  const quick = (minutes: number) => () => {
    if (disabled) return;
    setIsOn(true);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    onAction(`on ${minutes}m`, 'POST', '/ac/power', { action: 'on', minutes });
  };

  const clampMinutes = (n: number) => Math.max(5, Math.min(240, Math.round(n)));
  const presets = [15, 30, 45, 60, 90, 120, 150, 180, 240];

  // Removed end-time mode: no end date/time computation
  const openCustom = () => { if (!disabled) setShowCustom(true); };
  const closeCustom = () => setShowCustom(false);
  const confirmCustom = () => {
    const minutes = clampMinutes(customMinutes || 0);
    setCustomMinutes(minutes);
    setIsOn(true);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    onAction(`on ${minutes}m`, 'POST', '/ac/power', { action: 'on', minutes });
    setShowCustom(false);
  };

  return (
    <Card style={[styles.card, { backgroundColor: Design.colors.surfaceElevated, borderWidth: 1, borderColor: Design.colors.border }]}>
      <View style={styles.headerRow}>
        <View style={styles.iconBadge}>
          <MaterialCommunityIcons name="air-conditioner" size={22} color={Design.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText type="subtitle">AC Controls</ThemedText>
          <ThemedText style={[styles.helper, { marginTop: 2 }]}>Power and quick timers</ThemedText>
        </View>
        <View style={styles.switchWrap}>
          <Switch
            value={isOn}
            onValueChange={handleToggle}
            disabled={disabled}
            trackColor={{ false: '#E5E5EA', true: '#CFEAD2' }}
            thumbColor={isOn ? statusColor : '#FFFFFF'}
            style={styles.switchScaled}
          />
          <ThemedText style={[styles.switchLabel, { color: statusColor }]}>{statusLabel}</ThemedText>
        </View>
      </View>

      <ThemedText style={styles.helper}>Quick start</ThemedText>
      <View style={styles.quickRow}>
        <PrimaryButton title="15m" onPress={quick(15)} style={styles.smallBtn} iconLeft="clock-outline" disabled={disabled} />
        <PrimaryButton title="30m" onPress={quick(30)} style={styles.smallBtn} iconLeft="clock-outline" disabled={disabled} />
        <PrimaryButton title="1h" onPress={quick(60)} style={styles.smallBtn} iconLeft="clock-outline" disabled={disabled} />
        <PrimaryButton title="2h" onPress={quick(120)} style={styles.smallBtn} iconLeft="clock-outline" disabled={disabled} />
        <PrimaryButton title="Custom" onPress={openCustom} style={styles.smallBtn} iconLeft="clock-edit-outline" disabled={disabled} />
      </View>

      <Modal visible={showCustom} transparent animationType="fade" onRequestClose={closeCustom}>
        <BlurView intensity={40} tint="default" style={styles.modalFill}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeCustom} />
          <Card style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <MaterialCommunityIcons name="clock-edit-outline" size={22} color={Design.colors.primary} />
              <ThemedText type="subtitle">Custom Timer</ThemedText>
            </View>
            <ThemedText style={styles.helper}>Select duration in minutes</ThemedText>
            <View style={styles.presetsGrid}>
              {presets.map((p) => (
                <Pressable key={p} onPress={() => setCustomMinutes(p)} style={[styles.presetChip, customMinutes===p && styles.presetChipActive]}>
                  <ThemedText style={[styles.presetLabel, customMinutes===p && styles.presetLabelActive]}>{p}</ThemedText>
                </Pressable>
              ))}
            </View>
            <View style={styles.pickerRow}>
              <IconButton name="minus" onPress={() => setCustomMinutes(m => clampMinutes((m || 0) - 5))} color={Design.colors.textPrimary} background={Design.colors.muted} />
              <TextInput
                value={String(customMinutes || '')}
                onChangeText={(t) => setCustomMinutes(clampMinutes(parseInt(t.replace(/\D+/g, '') || '0', 10)))}
                keyboardType="number-pad"
                inputMode="numeric"
                style={styles.input}
                placeholder="30"
                placeholderTextColor="#A0A0A0"
                maxLength={3}
              />
              <IconButton name="plus" onPress={() => setCustomMinutes(m => clampMinutes((m || 0) + 5))} color={Design.colors.textPrimary} background={Design.colors.muted} />
            </View>
            <ThemedText style={{ textAlign: 'center', color: Design.colors.textSecondary }}>Range: 5–240 min</ThemedText>

            <View style={styles.modalActions}>
              <PrimaryButton title="Cancel" onPress={closeCustom} variant="neutral" appearance="soft" />
              <PrimaryButton title="Start" onPress={confirmCustom} variant="primary" appearance="solid" />
            </View>
          </Card>
        </BlurView>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Design.spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Design.spacing.md },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Design.colors.muted,
  },
  switchWrap: { alignItems: 'center', paddingHorizontal: 2 },
  switchScaled: { transform: [{ scaleX: 1.18 }, { scaleY: 1.18 }] },
  switchLabel: { marginTop: 4, fontSize: 16, fontWeight: '600' },
  helper: { color: Design.colors.textSecondary },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Design.spacing.sm },
  smallBtn: { paddingVertical: 10, paddingHorizontal: 18 },
  modalFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '88%', maxWidth: 420, gap: Design.spacing.md },
  pickerRow: { marginVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: {
    width: 120,
    height: 56,
    borderRadius: Design.radii.pill,
    backgroundColor: Design.colors.mutedSurface,
    borderWidth: 1,
    borderColor: Design.colors.border,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: Design.colors.textPrimary,
  },
  segmentRow: { flexDirection: 'row', gap: 8, backgroundColor: Design.colors.muted, padding: 4, borderRadius: Design.radii.pill },
  segment: { flex: 1, paddingVertical: 8, borderRadius: Design.radii.pill, alignItems: 'center' },
  segmentActive: { backgroundColor: Design.colors.surfaceElevated, borderWidth: 1, borderColor: Design.colors.border },
  segmentLabel: { color: Design.colors.textSecondary },
  segmentLabelActive: { color: Design.colors.textPrimary, fontWeight: '700' },
  presetsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  presetChip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: Design.radii.pill, backgroundColor: Design.colors.mutedSurface, borderWidth: 1, borderColor: Design.colors.border },
  presetChipActive: { backgroundColor: Design.colors.accentTintBg, borderColor: Design.colors.accent },
  presetLabel: { fontSize: 16, color: Design.colors.textSecondary },
  presetLabelActive: { color: Design.colors.primary, fontWeight: '700' },
  endRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  endDateLabel: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600' },
  endTimeRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  stepCol: { alignItems: 'center', gap: 6 },
  endTimeUnit: { fontSize: 12, color: Design.colors.textSecondary, marginBottom: 4 },
  endTimeValue: { fontSize: 28, fontWeight: '700', color: Design.colors.textPrimary },
  modalActions: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
