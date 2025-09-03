import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Design } from '@/constants/Design';
import { getAuth } from '@/lib/auth';

function PrimaryButton(props: { title: string; onPress: () => void }) {
  return (
    <ThemedView style={styles.primaryButton}>
      <ThemedText type="link" onPress={props.onPress} style={styles.primaryButtonText}>{props.title}</ThemedText>
    </ThemedView>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    (async () => {
      const auth = await getAuth();
      setHasSession(!!auth?.server?.token);
    })();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedView style={styles.hero}>
        <ThemedText type="headline" style={styles.heroTitle}>HKUST Smart AC</ThemedText>
        <ThemedText style={styles.heroSubtitle}>Gérez la climatisation de votre chambre, suivez votre solde et programmez des minuteries.</ThemedText>
      </ThemedView>

      <View style={styles.card}>
        <ThemedText type="subtitle" style={{ marginBottom: Design.spacing.sm }}>Bienvenue</ThemedText>
        <ThemedText>Connectez-vous via CAS pour commencer.</ThemedText>
      </View>

      <View style={{ height: Design.spacing.lg }} />

      <PrimaryButton title="Connect with HKUST" onPress={() => router.push('/login')} />

      {hasSession && (
        <View style={{ marginTop: Design.spacing.sm }}>
          <ThemedText type="link" onPress={() => router.replace('/(tabs)')}>Déjà connecté ? Aller à l'accueil →</ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Design.spacing.lg,
    backgroundColor: Design.colors.background,
  },
  hero: {
    borderRadius: Design.radii.large,
    padding: Design.spacing.xl,
    ...Design.shadow.card,
    marginBottom: Design.spacing.lg,
    backgroundColor: Design.colors.primary,
  },
  heroTitle: {
    color: 'white',
    marginBottom: Design.spacing.xs,
  },
  heroSubtitle: {
    color: 'white',
  },
  card: {
    backgroundColor: Design.colors.surface,
    borderRadius: Design.radii.medium,
    padding: Design.spacing.lg,
    ...Design.shadow.card,
  },
  primaryButton: {
    borderRadius: Design.radii.pill,
    paddingVertical: Design.spacing.md,
    paddingHorizontal: Design.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Design.shadow.floating,
    backgroundColor: Design.colors.primary,
  },
  primaryButtonText: {
    color: 'white',
  },
});
