import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Design } from '@/constants/Design';

function PrimaryButton(props: { title: string; onPress: () => void }) {
  return (
    <ThemedView style={styles.primaryButton}>
      <ThemedText type="link" onPress={props.onPress} style={styles.primaryButtonText}>{props.title}</ThemedText>
    </ThemedView>
  );
}

export default function WelcomeNewScreen() {
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ThemedView style={styles.hero}>
        <ThemedText type="title" style={styles.heroTitle}>Bienvenue 🎉</ThemedText>
        <ThemedText style={styles.heroSubtitle}>Votre compte a été créé. Découvrons les fonctionnalités principales.</ThemedText>
      </ThemedView>

      <View style={styles.card}>
        <ThemedText type="subtitle" style={{ marginBottom: Design.spacing.sm }}>Ce que vous pouvez faire</ThemedText>
        <ThemedText>- Allumer/éteindre la climatisation</ThemedText>
        <ThemedText>- Programmer un minuteur</ThemedText>
        <ThemedText>- Suivre votre consommation en temps réel</ThemedText>
        <ThemedText>- Consulter le solde prépayé</ThemedText>
      </View>

      <View style={{ height: Design.spacing.lg }} />

      <PrimaryButton title="Skip → Accueil" onPress={() => router.replace('/(tabs)')} />
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
    gap: Design.spacing.xs,
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
