import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Design } from '@/constants/Design';
import PrimaryButton from '@/components/ui/PrimaryButton';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView
      style={[
        styles.container,
        {
          // Make login screen high-contrast: white background, violet text/icon
          backgroundColor: '#FFFFFF',
          paddingTop: insets.top + Design.spacing.lg,
          paddingBottom: insets.bottom + Design.spacing.lg,
        },
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Decorative background shapes in faint violet */}
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <View style={[styles.pill, { top: 80, left: -30, opacity: 0.12 }]} />
        <View style={[styles.pill, { top: 180, right: -40, opacity: 0.08 }]} />
        <View style={[styles.pill, { bottom: 120, left: -20, opacity: 0.08 }]} />
        <View style={[styles.pill, { bottom: 40, right: -30, opacity: 0.10 }]} />
        <View style={[styles.diag, { top: 70, left: 60, opacity: 0.12 }]} />
        <View style={[styles.diag, { top: 140, right: 50, opacity: 0.08 }]} />
        <View style={[styles.diag, { bottom: 160, left: 40, opacity: 0.08 }]} />
        <View style={[styles.diag, { bottom: 60, right: 30, opacity: 0.10 }]} />
      </View>

      <View style={styles.centerWrap}>
        <View style={styles.logoCircle}>
          <MaterialCommunityIcons name="air-conditioner" size={96} color={Design.colors.primary} />
        </View>
        <ThemedText type="title" style={styles.brandTitle}>HKUST Smart AC</ThemedText>

        <PrimaryButton
          title="Login with HKUST Account"
          onPress={() => router.push('/login')}
          appearance="solid"
          variant="primary"
          style={{ marginTop: Design.spacing.xl }}
        />
      </View>
      {/* Footer disclaimer anchored to bottom */}
      <View style={[styles.footer, { bottom: insets.bottom + Design.spacing.lg }]} pointerEvents="none">
        <ThemedText style={styles.subtleCaption}>HKUST Smart AC was not affiliated with HKUST.</ThemedText>
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
    color: Design.colors.primary,
  },
  logoCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Design.colors.border,
    ...Design.shadow.floating,
  },
  pill: {
    position: 'absolute',
    width: 200,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(108,92,231,0.15)',
    transform: [{ rotate: '45deg' }],
  },
  diag: {
    position: 'absolute',
    width: 2,
    height: 180,
    backgroundColor: 'rgba(108,92,231,0.15)',
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  subtleCaption: {
    marginTop: Design.spacing.xs,
    textAlign: 'center',
    fontSize: 12,
    color: Design.colors.primary,
  },
  footer: {
    position: 'absolute',
    left: Design.spacing.lg,
    right: Design.spacing.lg,
    bottom: Design.spacing.lg,
    alignItems: 'center',
    zIndex: 1,
  },
});
