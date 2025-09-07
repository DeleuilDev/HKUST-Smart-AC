import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Card from '@/components/ui/Card';
import { ThemedText } from '@/components/ThemedText';
import PrimaryButton from '@/components/ui/PrimaryButton';
import DateTimeField from '@/components/ui/DateTimeField';
import { Design } from '@/constants/Design';
import { backendAuthedFetch } from '@/lib/backend';
import { clearAuth } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type ActionType = 'power_on' | 'power_off' | 'set_timer';

type ScheduledAction = {
  id: string;
  userId: string;
  type: ActionType;
  payload?: Record<string, unknown>;
  scheduledAt: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled';
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  executedAt?: string;
};

export default function ScheduleCard() {
  const router = useRouter();
  const [type, setType] = useState<ActionType>('power_on');
  const initialDate = useMemo(() => {
    const d = new Date();
    const m = d.getMinutes();
    const next5 = Math.ceil(m / 5) * 5;
    d.setMinutes(next5 % 60, 0, 0);
    if (next5 >= 60) d.setHours(d.getHours() + 1);
    return d;
  }, []);
  const [scheduledDate, setScheduledDate] = useState<Date>(initialDate);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<ScheduledAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // scheduledDate kept as a single Date via DateTimeField

  const formatDate = (d: Date) => {
    try {
      return d.toLocaleString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
      });
    } catch {
      return d.toISOString();
    }
  };

  const fetchList = useCallback(async () => {
    setError(null);
    try {
      const res = await backendAuthedFetch('/schedule');
      if (res.status === 401 || res.status === 403) {
        try { await clearAuth(); } catch {}
        router.replace('/welcome');
        return;
      }
      const txt = await res.text();
      const data = safeJson(txt);
      const arr: ScheduledAction[] = Array.isArray(data?.items) ? data.items : [];
      setItems(arr);
    } catch (e: any) {
      setError(e?.message || 'Failed to load scheduled actions');
    }
  }, [router]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      const now = Date.now();
      if (scheduledDate.getTime() <= now) {
        setError('Veuillez choisir une date/heure future.');
        return;
      }
      const body = { type, scheduledAt: scheduledDate.toISOString() };
      const res = await backendAuthedFetch('/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const txt = await res.text();
      if (res.status === 401 || res.status === 403) {
        try { await clearAuth(); } catch {}
        setError('Session expirée. Veuillez vous reconnecter.');
        router.replace('/welcome');
        return;
      }
      const data = safeJson(txt);
      if (res.ok) {
        setInfo('Action programmée');
        await fetchList();
      } else {
        setError(String(data?.error || data?.errorMessage || 'Échec de programmation'));
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (id: string) => {
    setError(null);
    try {
      const res = await backendAuthedFetch(`/schedule/${id}`, { method: 'DELETE' });
      if (res.status === 401 || res.status === 403) {
        try { await clearAuth(); } catch {}
        router.replace('/welcome');
        return;
      }
      await fetchList();
    } catch (e: any) {
      setError(e?.message || 'Annulation impossible');
    }
  };

  const upcoming = items.filter((it) => it.status === 'pending').slice(0, 5);

  const inFuture = scheduledDate.getTime() > Date.now();

  return (
    <Card style={[styles.card, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECECEC' }]}>
      <View style={styles.headerRow}>
        <View style={styles.iconBadge}>
          <MaterialCommunityIcons name="calendar-clock" size={22} color={Design.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText type="subtitle">Schedule Actions</ThemedText>
          <ThemedText style={styles.helper}>Plan a one-off ON/OFF at a specific time</ThemedText>
        </View>
      </View>

      {/* Action type selector */}
      <View style={styles.segmentRow}>
        <PressableLike
          label="Power ON"
          icon="power"
          active={type === 'power_on'}
          onPress={() => setType('power_on')}
        />
        <PressableLike
          label="Power OFF"
          icon="power-off"
          active={type === 'power_off'}
          onPress={() => setType('power_off')}
        />
      </View>

      {/* Single combined Date+Time selector */}
      <DateTimeField value={scheduledDate} onChange={setScheduledDate} minimumDate={new Date()} style={{ marginTop: 8 }} />

      <PrimaryButton
        title={submitting ? 'Scheduling…' : 'Schedule'}
        onPress={submit}
        disabled={submitting || !inFuture}
        variant="primary"
        appearance="solid"
        iconLeft={type === 'power_on' ? 'power' : 'power-off'}
      />
      {error ? <ThemedText style={{ color: Design.colors.statusNegative }}>{error}</ThemedText> : null}
      {info ? <ThemedText style={{ color: Design.colors.statusPositive }}>{info}</ThemedText> : null}

      {/* Upcoming list */}
      <View style={{ marginTop: 8, gap: 8 }}>
        <ThemedText type="subtitle">Upcoming</ThemedText>
        {upcoming.length === 0 && (
          <View style={styles.emptyUp}>
            <ThemedText style={styles.helper}>No upcoming actions</ThemedText>
          </View>
        )}
        {upcoming.map((it) => (
          <View key={it.id} style={styles.upItem}>
            <View>
              <ThemedText style={{ fontWeight: '700' }}>{labelFor(it.type)}</ThemedText>
              <ThemedText style={{ color: Design.colors.textSecondary }}>{formatDate(new Date(it.scheduledAt))}</ThemedText>
            </View>
            <PrimaryButton title="Cancel" onPress={() => cancel(it.id)} variant="neutral" appearance="soft" size="sm" />
          </View>
        ))}
      </View>
    </Card>
  );
}

function safeJson(txt: string) {
  try { return JSON.parse(txt); } catch { return {}; }
}

function labelFor(t: ActionType) {
  if (t === 'power_on') return 'Power ON';
  if (t === 'power_off') return 'Power OFF';
  return 'Set Timer';
}

function PressableLike({ label, active, onPress, icon }: { label: string; active?: boolean; onPress: () => void; icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }) {
  return (
    <View style={[styles.segment, active && styles.segmentActive]}>
      <PrimaryButton title={label} iconLeft={icon} onPress={onPress} variant={active ? 'primary' : 'neutral'} appearance={active ? 'solid' : 'soft'} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Design.spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F1F4',
  },
  helper: { color: Design.colors.textSecondary },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1 },
  segmentActive: {},
  endRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dateLabel: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600' },
  timeRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  stepCol: { alignItems: 'center', gap: 6 },
  timeUnit: { fontSize: 12, color: Design.colors.textSecondary, marginBottom: 4 },
  timeValue: { fontSize: 28, fontWeight: '700', color: Design.colors.textPrimary },
  upItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, borderRadius: 10, backgroundColor: '#F7F7FA', borderWidth: 1, borderColor: '#ECECEC' },
  emptyUp: { padding: 12, borderRadius: 10, backgroundColor: '#F7F7FA', borderWidth: 1, borderColor: '#ECECEC', alignItems: 'center' },
});
