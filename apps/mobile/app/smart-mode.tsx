import React, { useMemo, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, View, TextInput, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import Card from '@/components/ui/Card';
import PrimaryButton from '@/components/ui/PrimaryButton';
import IconButton from '@/components/ui/IconButton';
import { Design } from '@/constants/Design';
import { backendAuthedFetch } from '@/lib/backend';
import { clearAuth } from '@/lib/auth';
import { useFocusEffect } from '@react-navigation/native';

export default function SmartModeScreen() {
  const [runMinutes, setRunMinutes] = useState<number>(20);
  const [pauseMinutes, setPauseMinutes] = useState<number>(10);
  const [totalMinutes, setTotalMinutes] = useState<number>(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [active, setActive] = useState<boolean>(false);
  const [config, setConfig] = useState<any | null>(null);
  const prefilledOnce = React.useRef(false);
  const [dirty, setDirty] = useState<boolean>(false);

  const reloadConfig = useCallback(async () => {
    try {
      const res = await backendAuthedFetch('/smart-mode');
      const txt = await res.text(); const body = safeJson(txt);
      const cfg = body?.config;
      setConfig(cfg || null);
      if (cfg) {
        const isActive = Boolean(cfg.active);
        setActive(isActive);
        // Only prefill inputs when not active, only once, and only if user hasn't edited yet
        if (!isActive && !prefilledOnce.current && !dirty) {
          setRunMinutes(Number(cfg.runMinutes || runMinutes));
          setPauseMinutes(Number(cfg.pauseMinutes || pauseMinutes));
          if (typeof cfg.totalMinutes === 'number') setTotalMinutes(Number(cfg.totalMinutes));
          prefilledOnce.current = true;
        }
      } else {
        setActive(false);
      }
    } catch {}
  }, [runMinutes, pauseMinutes]);

  React.useEffect(() => { reloadConfig(); }, [reloadConfig]);
  useFocusEffect(useCallback(() => { reloadConfig(); return () => {}; }, [reloadConfig]));

  // No clamping while typing; validation happens on Start or input blur.

  const savings = useMemo(() => {
    const r = runMinutes;
    const p = pauseMinutes;
    const denom = r + p;
    if (r <= 0 || denom <= 0) return 0;
    const ratio = p / denom; // off time proportion
    return Math.max(0, Math.min(1, ratio));
  }, [runMinutes, pauseMinutes]);

  const isValid = runMinutes > 0 && pauseMinutes >= 0 && Number.isFinite(runMinutes) && Number.isFinite(pauseMinutes);

  async function startSmart() {
    setSubmitting(true);
    setError(null); setInfo(null);
    try {
      if (runMinutes <= 0) { setError('Run minutes must be > 0'); return; }
      if (pauseMinutes < 0) { setError('Pause minutes must be ≥ 0'); return; }
      const payload: any = { runMinutes, pauseMinutes };
      if (totalMinutes > 0) payload.totalMinutes = totalMinutes;
      const res = await backendAuthedFetch('/smart-mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.status === 401 || res.status === 403) { try { await clearAuth(); } catch {}; return; }
      const ok = res.ok; const txt = await res.text(); const body = safeJson(txt);
      if (ok) {
        setInfo('Smart mode started'); setActive(true); await reloadConfig();
      } else {
        setError(String(body?.error || body?.errorMessage || 'Failed'));
      }
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally { setSubmitting(false); }
  }

  async function stopSmart() {
    setSubmitting(true); setError(null); setInfo(null);
    try {
      const res = await backendAuthedFetch('/smart-mode', { method: 'DELETE' });
      if (res.status === 401 || res.status === 403) { try { await clearAuth(); } catch {}; return; }
      if (res.ok) { setActive(false); setInfo('Smart mode stopped'); await reloadConfig(); } else { const txt = await res.text(); const body = safeJson(txt); setError(String(body?.error || body?.errorMessage || 'Failed')); }
    } catch (e: any) { setError(e?.message || 'Failed'); } finally { setSubmitting(false); }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Smart Mode', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        {config?.active && (
          <CurrentInfo cfg={config} onStop={stopSmart} stopping={submitting} />
        )}

        <Card style={[styles.card, active && styles.cardDisabled]}>
          <ThemedText type="subtitle">Smart Mode</ThemedText>
          <ThemedText style={styles.helper}>Cycle ON for a period, then pause, repeat. Leave Total empty or 0 to run continuously.</ThemedText>

          <View style={styles.grid}>
            <NumberField
              label="Run (min)"
              value={runMinutes}
              onChange={(n) => { setRunMinutes(n); setDirty(true); }}
              step={5}
              disabled={active}
            />
            <NumberField
              label="Pause (min)"
              value={pauseMinutes}
              onChange={(n) => { setPauseMinutes(n); setDirty(true); }}
              step={5}
              disabled={active}
            />
            <NumberField
              label="Total (min, optional)"
              value={totalMinutes}
              onChange={(n) => { setTotalMinutes(n); setDirty(true); }}
              step={15}
              disabled={active}
            />
          </View>

          {!active && (
            <View style={{ marginTop: 2 }}>
              <View style={styles.pillRow}>
                <View style={styles.savingsPill}>
                  <ThemedText style={styles.savingsText}>Estimated savings · {Math.round(savings * 100)}%</ThemedText>
                </View>
              </View>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            {!active && (
              <PrimaryButton
                title={submitting ? 'Starting…' : 'Start Smart Mode'}
                onPress={startSmart}
                disabled={submitting || !isValid}
                variant="primary"
                appearance="solid"
                iconLeft="progress-clock"
              />
            )}
          </View>

          {!active && !isValid && (
            <ThemedText style={{ color: Design.colors.statusNegative }}>Run minutes must be greater than 0.</ThemedText>
          )}
        </Card>

        {error ? <ThemedText style={{ color: Design.colors.statusNegative }}>{error}</ThemedText> : null}
        {info ? <ThemedText style={{ color: Design.colors.statusPositive }}>{info}</ThemedText> : null}
      </ScrollView>
    </ThemedView>
  );
}

function NumberField({ label, value, onChange, step = 1, disabled }: { label: string; value: number; onChange: (n: number) => void; step?: number; disabled?: boolean }) {
  const [text, setText] = React.useState<string>(String(value ?? ''));
  React.useEffect(() => {
    // Sync external changes (e.g., after reloadConfig)
    setText(String(value ?? ''));
  }, [value]);
  const inc = () => {
    const next = Math.max(0, (Number.isFinite(value) ? (value || 0) : 0) + step);
    onChange(next);
    setText(String(next));
  };
  const dec = () => {
    const next = Math.max(0, (Number.isFinite(value) ? (value || 0) : 0) - step);
    onChange(next);
    setText(String(next));
  };
  const onTextChange = (t: string) => {
    // Allow any digits while typing; do not force a min/max here
    const digits = t.replace(/\D+/g, '');
    setText(digits);
  };
  const onBlur = () => {
    const normalized = text.trim() === '' ? 0 : parseInt(text, 10);
    if (!Number.isFinite(normalized) || normalized < 0) {
      onChange(0);
      setText('0');
    } else {
      onChange(normalized);
      setText(String(normalized));
    }
  };
  return (
    <View style={{ width: '100%' }}>
      <ThemedText style={styles.helper}>{label}</ThemedText>
      <View style={styles.stepRow}>
        <IconButton name="minus" onPress={disabled ? () => {} : dec} color={Design.colors.textPrimary} background={Design.colors.muted} />
        <TextInput
          value={text}
          onChangeText={onTextChange}
          onBlur={onBlur}
          keyboardType="number-pad"
          inputMode="numeric"
          style={styles.input}
          placeholder="0"
          placeholderTextColor="#A0A0A0"
          editable={!disabled}
        />
        <IconButton name="plus" onPress={disabled ? () => {} : inc} color={Design.colors.textPrimary} background={Design.colors.muted} />
      </View>
    </View>
  );
}

function safeJson(txt: string) { try { return JSON.parse(txt); } catch { return {}; } }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Design.colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 24 },
  card: { gap: 12, backgroundColor: Design.colors.surfaceElevated, borderWidth: 1, borderColor: Design.colors.border },
  cardDisabled: { opacity: 0.6 },
  helper: { color: Design.colors.textSecondary },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: {
    flex: 1,
    height: 56,
    borderRadius: Design.radii.pill,
    backgroundColor: Design.colors.mutedSurface,
    borderWidth: 1,
    borderColor: Design.colors.border,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: Design.colors.textPrimary,
    marginHorizontal: 8,
  },
  grid: { flexDirection: 'column', gap: 12 },
  infoBox: {
    borderWidth: 2,
    borderColor: Design.colors.accent,
    backgroundColor: Design.colors.accentTintBg,
    borderRadius: Design.radii.large,
    padding: 12,
    gap: 4,
  },
  infoPrimary: { fontSize: 18, fontWeight: '700', color: Design.colors.textPrimary },
  infoSecondary: { color: Design.colors.textSecondary },
  iconCompact: { width: 36, height: 36, borderRadius: 18 },
  pillRow: { flexDirection: 'row' },
  savingsPill: { backgroundColor: Design.colors.accentTintBg, borderColor: Design.colors.accent, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  savingsText: { color: Design.colors.primary, fontWeight: '700' },
});

function CurrentInfo({ cfg, onStop, stopping }: { cfg: any; onStop: () => void; stopping?: boolean }) {
  const run = Number(cfg?.runMinutes || 0);
  const pause = Number(cfg?.pauseMinutes || 0);
  const total = cfg?.totalMinutes != null ? Number(cfg.totalMinutes) : undefined;
  const rem = cfg?.remainingMinutes != null ? Number(cfg.remainingMinutes) : undefined;
  const totalStr = typeof total === 'number' ? `${total}m` : '—';
  const remainingStr = typeof rem === 'number' ? minutesToText(rem) : (typeof total === 'number' ? '—' : 'Unlimited');
  return (
    <View style={styles.infoBox}>
      <View style={styles.rowBetween}>
        <ThemedText style={styles.infoPrimary}>ON {run}m • OFF {pause}m • Total {totalStr}</ThemedText>
        <IconButton
          name={stopping ? 'progress-clock' : 'stop'}
          onPress={stopping ? () => {} : onStop}
          color={'#FFFFFF'}
          background={Design.colors.primary}
          style={[styles.iconCompact, stopping && { opacity: 0.6 }]}
        />
      </View>
      <ThemedText style={styles.infoSecondary}>Remaining: {remainingStr}</ThemedText>
    </View>
  );
}

function formatShort(d: Date) {
  try {
    return d.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric', hour12: false });
  } catch { return d.toISOString(); }
}

function minutesToText(mins: number) {
  const h = Math.floor(mins / 60); const m = mins % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}`;
}
