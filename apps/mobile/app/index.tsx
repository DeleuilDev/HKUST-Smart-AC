import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Design } from '@/constants/Design';
import { getAuth, clearAuth } from '@/lib/auth';
import { backendAuthedFetch } from '@/lib/backend';

export default function IndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState('Checking session…');

  useEffect(() => {
    (async () => {
      try {
        const auth = await getAuth();
        if (!auth?.server?.token) {
          setMessage('No session found');
          router.replace('/welcome');
          return;
        }
        const res = await backendAuthedFetch('/auth/me');
        if (res.ok) {
          router.replace('/profile');
          return;
        }
        // invalid/expired
        await clearAuth();
        router.replace('/welcome');
      } catch (e) {
        await clearAuth();
        router.replace('/welcome');
      } finally {
        setChecking(false);
      }
    })();
  }, [router]);

  return (
    <ThemedView
      style={[
        styles.container,
        {
          backgroundColor: Design.colors.primary,
          paddingTop: insets.top + Design.spacing.lg,
          paddingBottom: insets.bottom + Design.spacing.lg,
        },
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Decorative background shapes */}
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        {/* Rotated pills */}
        <View style={[styles.pill, { top: 80, left: -30, opacity: 0.18 }]} />
        <View style={[styles.pill, { top: 180, right: -40, opacity: 0.12 }]} />
        <View style={[styles.pill, { bottom: 120, left: -20, opacity: 0.10 }]} />
        <View style={[styles.pill, { bottom: 40, right: -30, opacity: 0.16 }]} />
        {/* Diagonal lines */}
        <View style={[styles.diag, { top: 70, left: 60 }]} />
        <View style={[styles.diag, { top: 140, right: 50 }]} />
        <View style={[styles.diag, { bottom: 160, left: 40 }]} />
        <View style={[styles.diag, { bottom: 60, right: 30 }]} />
      </View>

      {/* Center content (splash-style like login) */}
      <View style={styles.centerWrap}>
        <View style={styles.logoCircle}>
          <MaterialCommunityIcons name="air-conditioner" size={96} color="#FFFFFF" />
        </View>
        <ThemedText type="title" style={styles.brandTitle}>HKUST Smart AC</ThemedText>
        <ActivityIndicator color="#fff" />
        <ThemedText style={styles.subtleCaption}>{message}</ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Design.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerWrap: {
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
    gap: Design.spacing.lg,
  },
  brandTitle: {
    color: 'white',
  },
  // Big AC logo in a soft circle
  logoCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    ...Design.shadow.floating,
  },
  // Background shapes
  pill: {
    position: 'absolute',
    width: 200,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    transform: [{ rotate: '45deg' }],
  },
  diag: {
    position: 'absolute',
    width: 2,
    height: 180,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  primaryButton: {
    borderRadius: Design.radii.pill,
    paddingVertical: Design.spacing.md,
    paddingHorizontal: Design.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Design.shadow.floating,
    backgroundColor: 'white',
    alignSelf: 'stretch',
  },
  primaryButtonText: {
    color: Design.colors.primary,
  },
  subtleCaption: {
    marginTop: Design.spacing.xs,
    color: 'rgba(255,255,255,0.75)',
  },
});
