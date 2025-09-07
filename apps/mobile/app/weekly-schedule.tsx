import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import Card from '@/components/ui/Card';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { Design } from '@/constants/Design';
import { backendAuthedFetch } from '@/lib/backend';
import { clearAuth } from '@/lib/auth';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type WeeklyMode = 'on' | 'off';

const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2,'0')}:00`);
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function idxOf(dowMon0: number, hour: number) { // dowMon0: 0..6 Mon..Sun
  const dowSun0 = (dowMon0 + 1) % 7; // convert to JS getDay layout
  return dowSun0 * 24 + hour;
}

export default function WeeklyScheduleScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<WeeklyMode>('on');
  const [slots, setSlots] = useState<boolean[]>(() => Array(168).fill(false));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [initialMode, setInitialMode] = useState<WeeklyMode>('on');
  const [initialSlots, setInitialSlots] = useState<boolean[]>(() => Array(168).fill(false));

  useEffect(() => { (async () => {
    try {
      const res = await backendAuthedFetch('/schedule/weekly-plan');
      if (res.status === 401 || res.status === 403) { try { await clearAuth(); } catch {}; router.replace('/welcome'); return; }
      const txt = await res.text();
      const data = safeJson(txt);
      if (data?.plan) {
        const m = data.plan.mode === 'off' ? 'off' : 'on';
        const s = Array.isArray(data.plan.slots) && data.plan.slots.length === 168 ? data.plan.slots.map(Boolean) : Array(168).fill(false);
        setMode(m);
        setSlots(s);
        setInitialMode(m);
        setInitialSlots(s);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load plan');
    } finally {
      setLoading(false);
    }
  })(); }, [router]);

  const toggleCell = (d: number, h: number) => {
    const i = idxOf(d, h);
    setSlots((arr) => arr.map((v, k) => (k === i ? !v : v)));
  };

  const clear = () => setSlots((_) => Array(168).fill(false));
  const weekdays9to18 = () => {
    setSlots((arr) => {
      const next = Array(168).fill(false);
      for (let d = 0; d < 5; d++) { // Mon..Fri
        for (let h = 9; h < 18; h++) next[idxOf(d, h)] = true;
      }
      return next;
    });
  };

  const weekends10to18 = () => {
    setSlots((arr) => {
      const next = Array(168).fill(false);
      for (let d = 5; d < 7; d++) { // Sat, Sun (Mon0 index 5,6)
        for (let h = 10; h < 18; h++) next[idxOf(d, h)] = true;
      }
      return next;
    });
  };

  const invert = () => setSlots((arr) => arr.map((v) => !v));

  const toggleDay = (d: number) => {
    // if majority unchecked → set all true else all false
    let active = 0;
    for (let h = 0; h < 24; h++) if (slots[idxOf(d, h)]) active++;
    const target = active < 12; // fill if less than half
    setSlots((arr) => arr.map((v, i) => {
      const hour = i % 24; const sun0 = Math.floor(i / 24); const mon0 = (sun0 + 6) % 7;
      return mon0 === d ? target : v;
    }));
  };

  const toggleHour = (h: number) => {
    // across all days
    let active = 0;
    for (let d = 0; d < 7; d++) if (slots[idxOf(d, h)]) active++;
    const target = active < 4;
    setSlots((arr) => arr.map((v, i) => {
      const hour = i % 24; return hour === h ? target : v;
    }));
  };

  const save = async () => {
    setSaving(true); setError(null); setInfo(null);
    try {
      const res = await backendAuthedFetch('/schedule/weekly-plan', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, slots })
      });
      if (res.status === 401 || res.status === 403) { try { await clearAuth(); } catch {}; router.replace('/welcome'); return; }
      const ok = res.ok; const txt = await res.text(); const body = safeJson(txt);
      if (ok) { setInfo('Weekly plan saved'); setInitialMode(mode); setInitialSlots(slots); }
      else setError(String(body?.error || body?.errorMessage || 'Save failed'));
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const resetToInitial = () => { setMode(initialMode); setSlots(initialSlots); };

  const changed = useMemo(() => {
    if (mode !== initialMode) return true;
    if (!Array.isArray(initialSlots) || initialSlots.length !== slots.length) return true;
    for (let i = 0; i < slots.length; i++) if (!!slots[i] !== !!initialSlots[i]) return true;
    return false;
  }, [mode, slots, initialMode, initialSlots]);

  const activeHours = useMemo(() => slots.reduce((acc, v) => acc + (v ? 1 : 0), 0), [slots]);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Weekly Schedule', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={[styles.card]}>
          <View style={styles.headerWrap}>
            <View style={{ flex: 1 }}>
              <ThemedText type="subtitle">Weekly shedule</ThemedText>
            </View>
            <View style={styles.segmentRow}>
              <Pressable onPress={() => setMode('on')} style={[styles.segment, mode==='on' && styles.segmentActive]}> 
                <ThemedText style={[styles.segmentLabel, mode==='on' && styles.segmentLabelActive]}>On</ThemedText>
              </Pressable>
              <Pressable onPress={() => setMode('off')} style={[styles.segment, mode==='off' && styles.segmentActive]}> 
                <ThemedText style={[styles.segmentLabel, mode==='off' && styles.segmentLabelActive]}>Off</ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <PrimaryButton title="Clear" onPress={clear} variant="neutral" />
            <PrimaryButton title={saving ? 'Saving…' : 'Save'} onPress={save} appearance="solid" variant="primary" disabled={!changed || saving} />
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: '#EBE9FF', borderColor: Design.colors.accent }]} />
              <ThemedText style={styles.helper}>Active</ThemedText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: '#FFFFFF', borderColor: '#ECECEC' }]} />
              <ThemedText style={styles.helper}>Inactive</ThemedText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: '#FFFFFF', borderColor: Design.colors.primary, borderWidth: 2 }]} />
              <ThemedText style={styles.helper}>Now</ThemedText>
            </View>
          </View>

          {/* Grid */}
          <ScrollView horizontal style={{ marginTop: 8 }}>
            <View>
              <View style={styles.headerRow}>
                <View style={[styles.timeCell, { backgroundColor: 'transparent' }]} />
                {DAYS.map((d, mon0) => {
                  const now = new Date();
                  const isToday = (now.getDay() + 6) % 7 === mon0;
                  return (
                    <Pressable key={d} onPress={() => toggleDay(mon0)} style={[styles.dayHeader, isToday && styles.dayHeaderActive]}>
                      <ThemedText style={[{ fontWeight: '700' }, isToday && { color: Design.colors.primary }]}>{d}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              {HOURS.map((label, h) => (
                <View key={h} style={styles.row}>
                  <Pressable onPress={() => toggleHour(h)} style={styles.timeCell}><ThemedText style={styles.timeLabel}>{label}</ThemedText></Pressable>
                  {DAYS.map((_d, d) => {
                    const i = idxOf(d, h);
                    const active = !!slots[i];
                    // Highlight current time/day
                    const now = new Date();
                    const isNow = now.getHours() === h && (now.getDay() + 6) % 7 === d;
                    return (
                      <Pressable key={`${d}-${h}`} onPress={() => toggleCell(d, h)} style={[styles.cell, active && styles.cellActive, isNow && styles.cellNow]}>
                        {/* empty cell */}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </Card>

        {error ? <ThemedText style={{ color: Design.colors.statusNegative }}>{error}</ThemedText> : null}
        {info ? <ThemedText style={{ color: Design.colors.statusPositive }}>{info}</ThemedText> : null}
      </ScrollView>
    </ThemedView>
  );
}

function safeJson(txt: string) { try { return JSON.parse(txt); } catch { return {}; } }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Design.colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 24 },
  card: { gap: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECECEC', paddingBottom: 12 },
  headerWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F1F4',
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  segmentRow: { flexDirection: 'row', gap: 8, backgroundColor: '#F1F1F4', padding: 4, borderRadius: Design.radii.pill },
  segment: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: Design.radii.pill },
  segmentActive: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5EA' },
  segmentLabel: { color: Design.colors.textSecondary },
  segmentLabelActive: { color: Design.colors.textPrimary, fontWeight: '700' },
  headerRow: { flexDirection: 'row' },
  dayHeader: { width: 90, paddingVertical: 8, alignItems: 'center', borderBottomWidth: 1, borderColor: '#ECECEC' },
  dayHeaderActive: { backgroundColor: '#F7F7FA', borderBottomColor: Design.colors.accent },
  row: { flexDirection: 'row' },
  timeCell: { width: 70, paddingVertical: 8, paddingHorizontal: 8, alignItems: 'flex-end', borderRightWidth: 1, borderColor: '#ECECEC' },
  timeLabel: { color: Design.colors.textSecondary },
  cell: { width: 90, height: 28, borderWidth: 1, borderColor: '#ECECEC', backgroundColor: '#FFFFFF' },
  cellActive: { backgroundColor: '#EBE9FF', borderColor: Design.colors.accent },
  cellNow: { borderColor: Design.colors.primary, borderWidth: 2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 14, height: 14, borderRadius: 2, borderWidth: 1 },
});
