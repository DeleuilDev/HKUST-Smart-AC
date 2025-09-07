import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Design } from '@/constants/Design';
import ScheduleCard from '@/components/ui/ScheduleCard';

export default function ScheduleScreen() {
  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Schedule Actions', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: 12 }}>
          <ThemedText type="title">Schedule Actions</ThemedText>
          <ThemedText style={{ color: Design.colors.textSecondary }}>
            Create and manage scheduled ON/OFF actions for your AC. Choose a date and time; cancel upcoming actions anytime.
          </ThemedText>
        </View>
        <ScheduleCard />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Design.colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 24 },
});

