import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import PrimaryButton from '@/components/ui/PrimaryButton';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Design } from '@/constants/Design';

export default function DateTimeField({
  label = 'Date & Time',
  value,
  onChange,
  minimumDate,
  style,
}: {
  label?: string;
  value: Date;
  onChange: (d: Date) => void;
  minimumDate?: Date;
  style?: ViewStyle;
}) {
  const [open, setOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const openPicker = () => {
    if (Platform.OS === 'ios') setOpen((v) => !v);
    else setShowDatePicker(true);
  };

  const onDateChange = (_: any, selected?: Date) => {
    if (!selected) {
      setShowDatePicker(false);
      return;
    }
    const next = new Date(value);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    onChange(next);
    setShowDatePicker(false);
    if (Platform.OS === 'android') setShowTimePicker(true);
  };

  const onTimeChange = (_: any, selected?: Date) => {
    if (!selected) {
      setShowTimePicker(false);
      return;
    }
    const next = new Date(value);
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    onChange(next);
    setShowTimePicker(false);
  };

  const formatted = useMemo(() => formatDateTime(value), [value]);

  return (
    <View style={[styles.container, style]}> 
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.label}>{label}</ThemedText>
          <ThemedText style={styles.value}>{formatted}</ThemedText>
        </View>
        <PrimaryButton title={open ? 'Close' : 'Pick'} onPress={openPicker} iconLeft="calendar-clock" />
      </View>
      {/* iOS: show inline date + time pickers stacked below the button */}
      {Platform.OS === 'ios' && open && (
        <View style={{ marginTop: 8 }}>
          <DateTimePicker
            value={value}
            mode="date"
            display="inline"
            onChange={onDateChange}
            minimumDate={minimumDate}
          />
          <View style={{ height: 8 }} />
          <DateTimePicker
            value={value}
            mode="time"
            display="spinner"
            onChange={onTimeChange}
          />
        </View>
      )}
      {/* Android: sequential native pickers */}
      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker
          value={value}
          mode="date"
          display="default"
          onChange={onDateChange}
          minimumDate={minimumDate}
        />
      )}
      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker
          value={value}
          mode="time"
          display="default"
          onChange={onTimeChange}
        />
      )}
    </View>
  );
}

function formatDateTime(d: Date) {
  try {
    return d.toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch {
    return d.toISOString();
  }
}

const styles = StyleSheet.create({
  container: { flexDirection: 'column', gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { color: Design.colors.textSecondary },
  value: { fontSize: 18, fontWeight: '700', color: Design.colors.textPrimary },
});
