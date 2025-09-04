import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';

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
// Icon usage moved into IconButton

type ApiResult = { status: number; body: any } | null;
type Status = { power?: 'on' | 'off'; temperature?: number } | null;

export default function ProfileScreen() {
  const router = useRouter();
  const [auth, setAuth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult>(null);
  const [status, setStatus] = useState<Status>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [totalPaid, setTotalPaid] = useState<number | null>(null);

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
        const [sRes, bRes] = await Promise.all([
          backendAuthedFetch('/ac/status'),
          backendAuthedFetch('/ac/balance'),
        ]);
        const s = safeJson(await sRes.text());
        const b = safeJson(await bRes.text());
        setStatus({ power: s?.power ?? s?.data?.power, temperature: s?.temperature ?? s?.data?.temperature });
        setBalance(Number(b?.balance ?? b?.data?.balance ?? NaN));
        setTotalPaid(Number(b?.totalPaidInMinute ?? b?.data?.totalPaidInMinute ?? NaN));
      } catch (_) {}
    })();
  }, [router]);

  const logout = async () => {
    await clearAuth();
    router.replace('/');
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
      if (path.includes('/ac/status')) setStatus(parsed as any);
      if (path.includes('/ac/balance')) {
        setBalance(Number((parsed as any)?.balance ?? (parsed as any)?.data?.balance ?? NaN));
        setTotalPaid(Number((parsed as any)?.totalPaidInMinute ?? (parsed as any)?.data?.totalPaidInMinute ?? NaN));
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur inconnue');
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
  const building: string | undefined = (serverUser as any)?.hallInfo?.bldg_short_nam || student?.bldg_short_nam || undefined;
  const room: string | undefined = (serverUser as any)?.hallInfo?.bldg_apt_room_nbr || student?.bldg_apt_room_nbr || undefined;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Dashboard', headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>

      {/* Hero header (styled like login) */}
      <View style={[styles.hero, { backgroundColor: Design.colors.primary }]}>
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          <View style={[styles.pill, { top: 30, left: -30, opacity: 0.18 }]} />
          <View style={[styles.pill, { top: 90, right: -40, opacity: 0.12 }]} />
          <View style={[styles.pill, { bottom: 30, left: -20, opacity: 0.1 }]} />
          <View style={[styles.pill, { bottom: -10, right: -30, opacity: 0.16 }]} />
        </View>
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <ThemedText type="title" style={{ color: 'white' }}>Hello{ greetingName ? `, ${greetingName}` : '' }</ThemedText>
            <ThemedText style={{ color: 'rgba(255,255,255,0.9)' }}>{building && room ? `${building} • Room ${room}` : 'Signed in'}</ThemedText>
          </View>
          <IconButton name="logout" onPress={logout} />
        </View>
      </View>

      {/* Content cards */}
      <View style={styles.cards}>
        {(typeof balance === 'number' || typeof totalPaid === 'number') && (
          <MinutesCard balance={balance ?? undefined} totalPaidInMinute={totalPaid ?? undefined} />
        )}

        <ACControlsCard onAction={handleApi} />

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
