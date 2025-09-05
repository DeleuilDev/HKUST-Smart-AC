import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { getAuth, clearAuth } from '@/lib/auth';
import { backendAuthedFetch } from '@/lib/backend';
import Card from '@/components/ui/Card';
import PrimaryButton from '@/components/ui/PrimaryButton';
import IconButton from '@/components/ui/IconButton';
import StatPill from '@/components/ui/StatPill';
import MinutesCard from '@/components/ui/MinutesCard';
import ACControlsCard from '@/components/ui/ACControlsCard';
import { Design } from '@/constants/Design';
import Toast from '@/components/ui/Toast';
import * as Haptics from 'expo-haptics';
// Icon usage moved into IconButton

type ApiResult = { status: number; body: any } | null;
type Status = { power?: 'on' | 'off'; temperature?: number } | null;

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [heroHeight, setHeroHeight] = useState(0);
  const [auth, setAuth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult>(null);
  const [status, setStatus] = useState<Status>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [totalPaid, setTotalPaid] = useState<number | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; variant: 'success' | 'error' | 'info' }>({ visible: false, message: '', variant: 'info' });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStatusAndBalance = useCallback(async () => {
    try {
      const [sRes, bRes] = await Promise.all([
        backendAuthedFetch('/ac/status'),
        backendAuthedFetch('/ac/balance'),
      ]);
      if (sRes.status === 401 || sRes.status === 403 || bRes.status === 401 || bRes.status === 403) {
        try { await clearAuth(); } catch {}
        setError('Token expiré/invalide. Veuillez vous reconnecter.');
        router.replace('/welcome');
        return;
      }
      const sTxt = await sRes.text();
      const bTxt = await bRes.text();
      const s = safeJson(sTxt);
      const b = safeJson(bTxt);
      setStatus(parseServerStatusToUi(s));
      setBalance(Number(b?.balance ?? b?.data?.balance ?? NaN));
      setTotalPaid(Number(b?.totalPaidInMinute ?? b?.data?.totalPaidInMinute ?? NaN));
    } catch (_) {
      // no-op: errors handled elsewhere when user triggers actions
    }
  }, [router]);

  useEffect(() => {
    (async () => {
      const a = await getAuth();
      if (!a) {
        setLoading(false);
        router.replace('/welcome');
        return;
      }
      if (!a.token) {
        const t = a?.raw?.data?.auth?.token || a?.raw?.token;
        if (t) a.token = t;
      }
      setAuth(a);
      setLoading(false);
      try {
        await fetchStatusAndBalance();
      } catch (_) {}
    })();
  }, [router, fetchStatusAndBalance]);

  // Refresh when the screen is focused, and poll every 30s
  useFocusEffect(
    useCallback(() => {
      let interval: ReturnType<typeof setInterval> | null = null;
      // Immediate refresh on focus
      fetchStatusAndBalance();
      // Poll every 30 seconds
      interval = setInterval(() => {
        fetchStatusAndBalance();
      }, 30_000);
      return () => {
        if (interval) clearInterval(interval);
      };
    }, [fetchStatusAndBalance])
  );

  const logout = async () => {
    await clearAuth();
    router.replace('/');
  };

  const showToast = (message: string, variant: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, message, variant });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2200);
  };

  const handleApi = async (_label: string, method: 'GET' | 'POST', path: string, body?: any) => {
    setError(null);
    setResult(null);
    try {
      const res = await backendAuthedFetch(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const txt = await res.text();
      const parsed = tryParse(txt);
      setResult({ status: res.status, body: parsed });
      if (res.status === 401 || res.status === 403) {
        setError('Token expiré/invalide. Veuillez vous reconnecter.');
        try { await clearAuth(); } catch {}
        router.replace('/welcome');
      }
      if (path.includes('/ac/status')) setStatus(parseServerStatusToUi(parsed));
      if (path.includes('/ac/balance')) {
        setBalance(Number((parsed as any)?.balance ?? (parsed as any)?.data?.balance ?? NaN));
        setTotalPaid(Number((parsed as any)?.totalPaidInMinute ?? (parsed as any)?.data?.totalPaidInMinute ?? NaN));
      }
      // Popup feedback on AC power operations: show server-provided message only
      if (path.includes('/ac/power')) {
        const serverMsg =
          typeof parsed === 'string'
            ? parsed
            : (parsed?.message ?? parsed?.body?.message ?? parsed?.data?.message ?? parsed?.msg ?? parsed?.error ?? '');
        if (serverMsg) {
          try { Haptics.notificationAsync(res.ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error); } catch {}
          showToast(String(serverMsg), res.ok ? 'success' : 'error');
        }
      }
    } catch (e: any) {
      const errMsg = e?.message || 'Erreur inconnue';
      setError(errMsg);
      showToast(errMsg, 'error');
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.loading}>
        <ActivityIndicator />
        <ThemedText style={{ marginTop: 8 }}>Chargement…</ThemedText>
      </ThemedView>
    );
  }

  const serverUser = auth?.server?.user || {};
  const student = auth?.raw?.data?.student;
  // Prefer backend-provided fields (surname/lastname, hallInfo); fallback to raw payload
  const greetingName: string | undefined =
    (serverUser?.lastname as string | undefined) ||
    (serverUser?.firstName as string | undefined) ||
    student?.full_name || student?.name || undefined;
  const greetingFirst: string | undefined = (greetingName || '')
    .trim()
    .split(/\s+/)[0] || undefined;
  const building: string | undefined = (serverUser as any)?.hallInfo?.bldg_short_nam || student?.bldg_short_nam || undefined;
  const room: string | undefined = (serverUser as any)?.hallInfo?.bldg_apt_room_nbr || student?.bldg_apt_room_nbr || undefined;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Dashboard', headerShown: false }} />
      {/* Fixed Hero header */}
      <View
        style={[styles.hero, styles.heroFixed, { backgroundColor: Design.colors.primary, paddingTop: insets.top + 12 }]}
        onLayout={(e) => setHeroHeight(e.nativeEvent.layout.height)}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          <View style={[styles.pill, { top: 30, left: -30, opacity: 0.18 }]} />
          <View style={[styles.pill, { top: 90, right: -40, opacity: 0.12 }]} />
          <View style={[styles.pill, { bottom: 30, left: -20, opacity: 0.1 }]} />
          <View style={[styles.pill, { bottom: -10, right: -30, opacity: 0.16 }]} />
        </View>
        <View style={styles.heroRow}>
          <IconButton name="account" onPress={() => { try { router.push('/profile-details'); } catch {} }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <ThemedText type="title" style={{ color: 'white', textAlign: 'center' }}>Hello{ greetingFirst ? `, ${greetingFirst}` : '' }</ThemedText>
            <ThemedText style={{ color: 'rgba(255,255,255,0.9)', textAlign: 'center' }}>{building && room ? `${building} • Room ${room}` : 'Signed in'}</ThemedText>
          </View>
          <IconButton name="logout" onPress={logout} />
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: heroHeight + 16, paddingBottom: insets.bottom + 24 }]}>

      {/* Content cards */}
      <View style={styles.cards}>
        {(typeof balance === 'number' || typeof totalPaid === 'number') && (
          <MinutesCard balance={balance ?? undefined} totalPaidInMinute={totalPaid ?? undefined} />
        )}

        <ACControlsCard onAction={handleApi} powerState={status?.power} />

        <Card>
          <ThemedText type="subtitle">Refresh</ThemedText>
          <View style={styles.rowGap}>
            <PrimaryButton title="Refresh Status" onPress={() => handleApi('status', 'GET', '/ac/status')} />
            <PrimaryButton title="Refresh Balance" onPress={() => handleApi('balance', 'GET', '/ac/balance')} />
          </View>
        </Card>

        <Card style={{ gap: 8 }}>
          <ThemedText type="subtitle">Last response</ThemedText>
          {error && <ThemedText style={{ color: '#E53935' }}>{error}</ThemedText>}
          {result ? <Pre json={result} /> : <ThemedText>Aucune requête encore.</ThemedText>}
        </Card>
      </View>

      </ScrollView>

      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        onHide={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </ThemedView>
  );
}

function Pre({ json }: { json: any }) {
  return (
    <ThemedView style={styles.pre}>
      <ThemedText>
        {typeof json === 'string' ? json : JSON.stringify(json, null, 2)}
      </ThemedText>
    </ThemedView>
  );
}

function tryParse(txt: string) {
  try { return JSON.parse(txt); } catch { return txt; }
}

function safeJson(txt: string) {
  try { return JSON.parse(txt); } catch { return {}; }
}

// Map raw /ac/status payload to UI-friendly Status
function parseServerStatusToUi(input: any): Status {
  if (!input || typeof input !== 'object') return { power: undefined, temperature: undefined };
  // Possible shapes after normalization: { ac_status: { DisconnectRelay, ... } }
  // Back-compat fallbacks also considered.
  const ac = input?.ac_status || input?.acStatus || input?.data?.ac_status || input?.data?.acStatus || input;

  // Interpret DisconnectRelay: true => ON, false => OFF (inverted)
  const disconnectRelay = ac?.DisconnectRelay ?? ac?.disconnectRelay;
  let power: 'on' | 'off' | undefined = undefined;
  if (typeof disconnectRelay === 'boolean') {
    power = disconnectRelay ? 'on' : 'off';
  } else if (typeof ac?.power === 'string') {
    const p = String(ac.power).toLowerCase();
    if (p === 'on' || p === 'off') power = p;
  } else if (typeof ac?.power === 'number') {
    power = ac.power === 1 ? 'on' : ac.power === 0 ? 'off' : undefined;
  }

  const temperature = typeof ac?.temperature === 'number' ? ac.temperature : undefined;
  return { power, temperature };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Design.colors.background,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  hero: {
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  heroFixed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    ...Design.shadow.floating,
  },
  statsRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 12,
  },
  cards: {
    padding: 16,
    gap: 16,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pre: {
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  rowGap: { gap: 12, marginTop: 12 },
  pill: {
    position: 'absolute',
    width: 200,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    transform: [{ rotate: '45deg' }],
  },
});
