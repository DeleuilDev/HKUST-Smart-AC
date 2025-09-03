import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { getAuth, clearAuth } from '@/lib/auth';
import { backendAuthedFetch } from '@/lib/backend';

type ApiResult = { status: number; body: any } | null;

function ButtonLike(props: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <ThemedView style={[styles.button, props.disabled && { opacity: 0.5 }]}>
      <ThemedText type="link" onPress={props.disabled ? undefined : props.onPress}>{props.title}</ThemedText>
    </ThemedView>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const [auth, setAuth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult>(null);

  useEffect(() => {
    (async () => {
      const a = await getAuth();
      if (!a) {
        setLoading(false);
        router.replace('/login');
        return;
      }
      // Fallback token injection if not set earlier
      if (!a.token) {
        const t = a?.raw?.data?.auth?.token || a?.raw?.token;
        if (t) a.token = t;
      }
      setAuth(a);
      setLoading(false);
    })();
  }, [router]);

  const logout = async () => {
    await clearAuth();
    router.replace('/(tabs)');
  };

  const handleApi = async (label: string, method: 'GET' | 'POST', path: string, body?: any) => {
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

  const student = auth?.raw?.data?.student;
  const name: string | undefined = student?.name || student?.full_name || undefined;
  const building: string | undefined = student?.bldg_short_nam || undefined;
  const room: string | undefined = student?.bldg_apt_room_nbr || undefined;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Profile', headerShown: true, headerBackVisible: false }} />
      <ThemedText type="title">Hello{ name ? `, ${name}` : '' } 👋</ThemedText>
      <ThemedText>
        {building && room ? `${building} • Room ${room}` : 'Signed in'}
      </ThemedText>

      <ThemedText style={styles.sectionTitle} type="subtitle">Test actions</ThemedText>
      <View style={styles.row}>
        <ButtonLike title="Balance" onPress={() => handleApi('balance', 'GET', '/ac/balance')} />
        <ButtonLike title="AC Status" onPress={() => handleApi('status', 'GET', '/ac/status')} />
      </View>
      <View style={styles.row}>
        <ButtonLike title="Power On" onPress={() => handleApi('on', 'POST', '/ac/power', { action: 'on' })} />
        <ButtonLike title="Power Off" onPress={() => handleApi('off', 'POST', '/ac/power', { action: 'off' })} />
      </View>
      <View style={styles.row}>
        <ButtonLike title="Sign out" onPress={logout} />
      </View>

      {error && <ThemedText style={{ color: 'red' }}>{error}</ThemedText>}
      {result && (
        <>
          <ThemedText style={styles.sectionTitle} type="subtitle">Last response</ThemedText>
          <Pre json={result} />
        </>
      )}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  sectionTitle: {
    marginTop: 8,
  },
  pre: {
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.08)'
  }
});
