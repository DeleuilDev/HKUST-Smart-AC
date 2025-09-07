import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import Card from '@/components/ui/Card';
import { backendAuthedFetch } from '@/lib/backend';
import { Design } from '@/constants/Design';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Entry = {
  id?: string;
  minutes: number;
  amountText: string;
  amountNumber?: number;
  currency?: string;
  method?: string;
  reference?: string;
  date?: string;
  status?: string;
  cycle?: string;
};

export default function TopupHistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Entry[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await backendAuthedFetch('/ac/topup-history');
        const txt = await res.text();
        const data = safeJson(txt);
        const list = normalizeHistory(data);
        setItems(list);
      } catch (e: any) {
        setError(e?.message || 'Failed to load history');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const summary = useMemo(() => computeSummary(items), [items]);

  return (
    <ThemedView style={{ flex: 1, backgroundColor: Design.colors.surface }}>
      <Stack.Screen options={{ title: 'Top-up History', headerShown: true }} />
      {loading ? (
        <View style={styles.center}> 
          <ActivityIndicator />
          <ThemedText style={{ marginTop: 8 }}>Loading history…</ThemedText>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <ThemedText style={{ color: Design.colors.statusNegative }}>{error}</ThemedText>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}
          data={items}
          keyExtractor={(it, idx) => String(it.id ?? it.reference ?? idx)}
          renderItem={({ item }) => <HistoryCard item={item} />}
          ListHeaderComponent={<SummaryCard summary={summary} />}
          ListEmptyComponent={<EmptyState />}
        />
      )}
    </ThemedView>
  );
}

function HistoryCard({ item }: { item: Entry }) {
  const dateStr = useMemo(() => formatDate(item.date), [item.date]);
  return (
    <Card style={[styles.itemCard]}>
      <View style={styles.itemRow}>
        <View style={[styles.iconCircle, { backgroundColor: Design.colors.accentTintBg }]}>
          <MaterialCommunityIcons name="credit-card-check-outline" size={22} color={Design.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.rowBetween}>
            <ThemedText type="subtitle">{item.minutes} min</ThemedText>
            <ThemedText style={{ fontWeight: '700' }}>{item.amountText}</ThemedText>
          </View>
          <View style={[styles.rowBetween, { marginTop: 6 }]}>
            <ThemedText style={{ color: Design.colors.textSecondary }}>{dateStr}</ThemedText>
            <View style={styles.rowGap}>
              {item.cycle ? (
                <View style={[styles.chip, { backgroundColor: Design.colors.accentTintBg }]}>
                  <ThemedText style={[styles.chipText, { color: Design.colors.primary }]}>{item.cycle}</ThemedText>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </Card>
  );
}

function SummaryCard({ summary }: { summary: { count: number; totalMinutes: number; totalAmountText: string } }) {
  return (
    <Card style={[styles.summaryCard]}>
      <ThemedText type="subtitle">Summary</ThemedText>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCell}>
          <ThemedText style={styles.summaryValue}>{summary.count}</ThemedText>
          <ThemedText style={styles.summaryLabel}>Top-ups</ThemedText>
        </View>
        <View style={styles.summaryCell}>
          <ThemedText style={styles.summaryValue}>{summary.totalMinutes}</ThemedText>
          <ThemedText style={styles.summaryLabel}>Minutes</ThemedText>
        </View>
        <View style={styles.summaryCell}>
          <ThemedText style={styles.summaryValue}>{summary.totalAmountText}</ThemedText>
          <ThemedText style={styles.summaryLabel}>Amount</ThemedText>
        </View>
      </View>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card style={{ alignItems: 'center', gap: 8 }}>
      <ThemedText type="subtitle">No top-ups yet</ThemedText>
      <ThemedText style={{ color: Design.colors.textSecondary, textAlign: 'center' }}>
        Top up your AC credit to see your history here.
      </ThemedText>
    </Card>
  );
}

function safeJson(txt: string) {
  try { return JSON.parse(txt); } catch { return {}; }
}

// Normalize a variety of potential upstream shapes into a list of entries we can render.
function normalizeHistory(data: any): Entry[] {
  const candidates: any[] = [];
  if (Array.isArray(data)) candidates.push(...data);
  if (Array.isArray(data?.data)) candidates.push(...data.data);
  if (Array.isArray(data?.history)) candidates.push(...data.history);
  if (Array.isArray(data?.records)) candidates.push(...data.records);
  if (Array.isArray(data?.items)) candidates.push(...data.items);
  if (Array.isArray(data?.result)) candidates.push(...data.result);
  if (Array.isArray(data?.top_ups)) {
    // School API shape: { top_ups: [{ topup_data: {...}, charge_unit: 'per_minute' }, ...] }
    const unwrapped = data.top_ups.map((it: any) => ({ ...(it?.topup_data || {}), charge_unit: it?.charge_unit }));
    candidates.push(...unwrapped);
  }

  const list = candidates.map((raw: any): Entry => {
    const minutes = pickNumber(raw, ['minutes', 'topup_minutes', 'topup_minute', 'credit', 'value', 'qty']) ?? 0;
    const amount = pickAmountBoth(raw);
    const method = pickString(raw, ['method', 'payment_method', 'channel', 'payment_channel']);
    const reference = pickString(raw, ['reference', 'ref', 'transaction_id', 'transactionId', 'id']);
    const date = pickDate(raw, ['date', 'topup_date', 'created_at', 'createdAt', 'time']);
    const status = pickString(raw, ['status']);
    const cycle = pickString(raw, ['billing_cycle_name', 'cycle', 'billingName']);
    const id = pickString(raw, ['id']);
    return { minutes, amountText: amount.text, amountNumber: amount.num, currency: amount.currency, method, reference, date, status, cycle, id };
  });
  return list;
}

function pickNumber(o: any, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = o?.[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  }
  return undefined;
}

function pickString(o: any, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o?.[k];
    if (typeof v === 'string' && v) return v;
  }
  return undefined;
}

function pickAmountBoth(o: any): { text: string; num?: number; currency?: string } {
  const currency = pickString(o, ['currency', 'curr', 'currency_code']) || '$';
  const amt = pickNumber(o, ['amount', 'paid', 'price', 'total', 'value']);
  if (typeof amt === 'number') return { text: `${currency}${amt}`, num: amt, currency };
  const text = pickString(o, ['amount_text', 'amountStr']);
  if (text) {
    const m = text.match(/([A-Z$€£])\s?(\d+[\.,]?\d*)/i);
    const num = m ? Number((m[2] || '0').replace(',', '.')) : undefined;
    const cur = m ? m[1] : currency;
    return { text, num, currency: cur };
  }
  return { text: `${currency}—`, currency };
}

function pickDate(o: any, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o?.[k];
    if (typeof v === 'string' || typeof v === 'number') {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  return undefined;
}

function formatDate(v?: string): string {
  if (!v) return '';
  try {
    const d = new Date(v);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(v);
  }
}

function computeSummary(items: Entry[]) {
  const count = items.length;
  const totalMinutes = items.reduce((acc, it) => acc + (typeof it.minutes === 'number' ? it.minutes : 0), 0);
  const currency = items.find((it) => it.currency)?.currency || '$';
  const sum = items.reduce((acc, it) => acc + (typeof it.amountNumber === 'number' ? it.amountNumber : 0), 0);
  const totalAmountText = `${currency}${Math.round(sum * 100) / 100}`;
  return { count, totalMinutes, totalAmountText };
}

function statusColors(status?: string) {
  const s = (status || '').toLowerCase();
  if (s.includes('paid') || s.includes('success')) return { bg: Design.colors.statusPositiveBg, fg: Design.colors.statusPositive };
  if (s.includes('fail') || s.includes('error')) return { bg: Design.colors.statusNegativeBg, fg: Design.colors.statusNegative };
  return { bg: Design.colors.statusWarningBg, fg: Design.colors.statusWarning };
}

function prettyStatus(status?: string) {
  if (!status) return '';
  const s = status.toLowerCase();
  if (s === 'paid') return 'Paid';
  if (s === 'pending') return 'Pending';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemCard: {
    backgroundColor: Design.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Design.colors.border,
    gap: 8,
  },
  itemRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  metaRow: { flexDirection: 'row', gap: 16, marginTop: 6 },
  metaPair: { flexDirection: 'row', gap: 6 },
  metaLabel: { color: Design.colors.textSecondary },
  metaValue: { fontWeight: '500' },
  summaryCard: {
    backgroundColor: Design.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Design.colors.border,
    marginBottom: 8,
    gap: 12,
  },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryCell: { alignItems: 'center', flex: 1 },
  summaryValue: { fontSize: 18, fontWeight: '700' },
  summaryLabel: { color: Design.colors.textSecondary },
});
