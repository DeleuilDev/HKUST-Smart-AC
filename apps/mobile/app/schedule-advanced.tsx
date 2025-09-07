import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import Card from '@/components/ui/Card';
import PrimaryButton from '@/components/ui/PrimaryButton';
import IconButton from '@/components/ui/IconButton';
import DateTimeField from '@/components/ui/DateTimeField';
import { Design } from '@/constants/Design';
import { backendAuthedFetch } from '@/lib/backend';
import { clearAuth } from '@/lib/auth';

function useNowRounded5() {
  return useMemo(() => {
    const d = new Date();
    const m = d.getMinutes();
    const next5 = Math.ceil(m / 5) * 5;
    d.setMinutes(next5 % 60, 0, 0);
    if (next5 >= 60) d.setHours(d.getHours() + 1);
    return d;
  }, []);
}

export default function ScheduleAdvancedScreen() {
  const now5 = useNowRounded5();

  // Range
  const [rangeStart, setRangeStart] = useState<Date>(now5);
  const [rangeEnd, setRangeEnd] = useState<Date>(new Date(now5.getTime() + 60 * 60 * 1000));
  const [submittingRange, setSubmittingRange] = useState(false);

  // Weekly
  // Sunday..Saturday (JS)
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const [selectedDays, setSelectedDays] = useState<boolean[]>([false, true, true, true, true, true, false]);
  const [startTime, setStartTime] = useState<Date>(now5);
  const [endTime, setEndTime] = useState<Date>(new Date(now5.getTime() + 60 * 60 * 1000));
  const [fromDate, setFromDate] = useState<Date>(new Date());
  const [weeksCount, setWeeksCount] = useState<number>(8);
  const [submittingWeekly, setSubmittingWeekly] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const toHHMM = (d: Date) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

  async function postRange() {
    setSubmittingRange(true);
    setError(null); setInfo(null);
    try {
      if (rangeEnd.getTime() <= rangeStart.getTime()) {
        setError('End must be after start');
        return;
      }
      const res = await backendAuthedFetch('/schedule/range', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: rangeStart.toISOString(), end: rangeEnd.toISOString() }),
      });
      if (res.status === 401 || res.status === 403) { try { await clearAuth(); } catch {}; return; }
      const ok = res.ok;
      const txt = await res.text();
      const body = safeJson(txt);
      if (ok) setInfo('Range scheduled'); else setError(String(body?.error || body?.errorMessage || 'Failed'));
    } finally { setSubmittingRange(false); }
  }

  async function postWeekly() {
    setSubmittingWeekly(true);
    setError(null); setInfo(null);
    try {
      const dows = selectedDays.map((v, idx) => v ? idx : -1).filter((v) => v >= 0);
      if (dows.length === 0) { setError('Select at least 1 day'); return; }
      if (endTime.getHours()*60+endTime.getMinutes() <= startTime.getHours()*60+startTime.getMinutes()) { setError('End time must be after start time'); return; }
      const payload = {
        daysOfWeek: dows,
        startTime: toHHMM(startTime),
        endTime: toHHMM(endTime),
        fromDate: fromDate.toISOString(),
        weeksCount,
      };
      const res = await backendAuthedFetch('/schedule/weekly', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (res.status === 401 || res.status === 403) { try { await clearAuth(); } catch {}; return; }
      const ok = res.ok; const txt = await res.text(); const body = safeJson(txt);
      if (ok) setInfo('Weekly plan scheduled'); else setError(String(body?.error || body?.errorMessage || 'Failed'));
    } finally { setSubmittingWeekly(false); }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Advanced Schedule', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <ThemedText type="subtitle">Date Range</ThemedText>
          <ThemedText style={styles.helper}>Turn ON at start, OFF at end</ThemedText>
          <DateTimeField label="Start" value={rangeStart} onChange={setRangeStart} minimumDate={new Date()} />
          <DateTimeField label="End" value={rangeEnd} onChange={setRangeEnd} minimumDate={rangeStart} />
          <PrimaryButton title={submittingRange ? 'Scheduling…' : 'Schedule Range'} onPress={postRange} disabled={submittingRange} variant="primary" appearance="solid" />
        </Card>

        <Card style={styles.card}>
          <ThemedText type="subtitle">Weekly Plan</ThemedText>
          <ThemedText style={styles.helper}>Pick days and time window</ThemedText>
          <View style={styles.daysRow}>
            {days.map((d, i) => (
              <Pressable key={d} onPress={() => setSelectedDays((arr) => arr.map((v, idx) => idx===i ? !v : v))} style={[styles.dayChip, selectedDays[i] && styles.dayChipActive]}>
                <ThemedText style={[styles.dayLabel, selectedDays[i] && styles.dayLabelActive]}>{d}</ThemedText>
              </Pressable>
            ))}
          </View>
          {/* Time only pickers */}
          <View style={styles.timeRow}>
            <TimeOnlyField label="Start time" value={startTime} onChange={setStartTime} />
            <TimeOnlyField label="End time" value={endTime} onChange={setEndTime} />
          </View>
          <DateTimeField label="From" value={fromDate} onChange={setFromDate} minimumDate={new Date()} />
          <View style={styles.rowBetween}>
            <ThemedText>Weeks</ThemedText>
            <View style={styles.stepRow}>
              <IconButton name="minus" onPress={() => setWeeksCount((n) => Math.max(1, n-1))} color={Design.colors.textPrimary} background={'#F1F1F4'} />
              <ThemedText style={styles.weeksVal}>{weeksCount}</ThemedText>
              <IconButton name="plus" onPress={() => setWeeksCount((n) => Math.min(52, n+1))} color={Design.colors.textPrimary} background={'#F1F1F4'} />
            </View>
          </View>
          <PrimaryButton title={submittingWeekly ? 'Scheduling…' : 'Create Weekly Plan'} onPress={postWeekly} disabled={submittingWeekly} variant="primary" appearance="solid" />
        </Card>

        {error ? <ThemedText style={{ color: Design.colors.statusNegative }}>{error}</ThemedText> : null}
        {info ? <ThemedText style={{ color: Design.colors.statusPositive }}>{info}</ThemedText> : null}
      </ScrollView>
    </ThemedView>
  );
}

function TimeOnlyField({ label, value, onChange }: { label: string; value: Date; onChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <ThemedText style={styles.helper}>{label}</ThemedText>
      <View style={styles.rowBetween}>
        <ThemedText style={styles.timeValue}>{value.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}</ThemedText>
        <PrimaryButton title={open ? 'Close' : 'Pick'} onPress={() => setOpen((v) => !v)} iconLeft="clock-outline" />
      </View>
      {open && (
        <View style={{ marginTop: 6 }}>
          {/* Use community picker directly here */}
          {Platform.select({
            ios: <DateTimeInlineTime value={value} onChange={onChange} />,
            default: <DateTimeInlineTime value={value} onChange={onChange} />,
          })}
        </View>
      )}
    </View>
  );
}

import DateTimePicker from '@react-native-community/datetimepicker';
function DateTimeInlineTime({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  return (
    <DateTimePicker
      value={value}
      mode="time"
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      onChange={(_e, d) => { if (d) onChange(new Date(value.getFullYear(), value.getMonth(), value.getDate(), d.getHours(), d.getMinutes(), 0, 0)); }}
    />
  );
}

function safeJson(txt: string) { try { return JSON.parse(txt); } catch { return {}; } }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Design.colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 24 },
  card: { gap: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECECEC' },
  helper: { color: Design.colors.textSecondary },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: Design.radii.pill, backgroundColor: '#F7F7FA', borderWidth: 1, borderColor: '#ECECEC' },
  dayChipActive: { backgroundColor: '#EBE9FF', borderColor: Design.colors.accent },
  dayLabel: { color: Design.colors.textSecondary },
  dayLabelActive: { color: Design.colors.primary, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeValue: { fontSize: 20, fontWeight: '700', color: Design.colors.textPrimary },
  weeksVal: { fontSize: 18, fontWeight: '700' },
});

