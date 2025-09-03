import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { getAuth, clearAuth } from '@/lib/auth';
import { backendAuthedFetch } from '@/lib/backend';

function ButtonLike(props: { title: string; onPress: () => void }) {
  return (
    <ThemedView style={styles.button}>
      <ThemedText type="link" onPress={props.onPress}>{props.title}</ThemedText>
    </ThemedView>
  );
}

export default function TokenScreen() {
  const router = useRouter();
  const [auth, setAuth] = useState<any>(null);
  const [apiResult, setApiResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const a = await getAuth();
      // Fallback extraction if token not already stored
      if (a && !a.token) {
        const t = a?.raw?.data?.auth?.token || a?.raw?.token;
        if (t) a.token = t;
      }
      setAuth(a);
    })();
  }, []);

  const logout = async () => {
    await clearAuth();
    router.replace('/(tabs)');
  };

  const testBalance = async () => {
    setError(null);
    setApiResult(null);
    try {
      const res = await backendAuthedFetch('/ac/balance');
      const txt = await res.text();
      setApiResult({ status: res.status, body: tryParse(txt) });
      if (res.status === 401 || res.status === 403) {
        setError('Token expiré/invalide. Veuillez vous reconnecter.');
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur inconnue');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Token / Details', headerShown: true }} />
      <ThemedText type="title">Authentication</ThemedText>
      {auth?.token ? (
        <ThemedText>Token detected: {shorten(auth.token)}</ThemedText>
      ) : (
        <ThemedText>No token detected in the response.</ThemedText>
      )}
      <ThemedText style={styles.sectionTitle} type="subtitle">Raw payload</ThemedText>
      <Pre json={auth?.raw ?? auth} />

      <View style={styles.row}>
        <ButtonLike title="Test balance (GET /prepaid/ac-balance)" onPress={testBalance} />
        <ButtonLike title="Sign out" onPress={logout} />
      </View>

      {error && <ThemedText style={{ color: 'red' }}>{error}</ThemedText>}
      {apiResult && (
        <>
          <ThemedText style={styles.sectionTitle} type="subtitle">API result</ThemedText>
          <Pre json={apiResult} />
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

function shorten(token: string, left = 10, right = 6) {
  if (!token) return '';
  if (token.length <= left + right + 3) return token;
  return token.slice(0, left) + '...' + token.slice(-right);
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
  pre: {
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  sectionTitle: {
    marginTop: 8,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.08)'
  }
});
