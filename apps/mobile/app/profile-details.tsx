import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import Card from '@/components/ui/Card';
import IconButton from '@/components/ui/IconButton';
import { Design } from '@/constants/Design';
import { getAuth } from '@/lib/auth';

export default function ProfileDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [auth, setAuth] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const a = await getAuth();
      setAuth(a);
    })();
  }, []);

  const serverUser = auth?.server?.user || {};
  const student = auth?.raw?.data?.student || {};
  const hall = serverUser?.hallInfo || student?.hallInfo || {};

  const fullName: string | undefined =
    (serverUser?.firstName as string | undefined) ||
    (serverUser?.lastname as string | undefined) ||
    (student?.full_name as string | undefined) ||
    (student?.name as string | undefined);
  const firstName: string | undefined = (fullName || '').trim().split(/\s+/)[0] || undefined;
  const building: string | undefined = hall?.bldg_short_nam;
  const room: string | undefined = hall?.bldg_apt_room_nbr;
  const initial: string | undefined = (firstName || fullName || '')
    .trim()
    .charAt(0)
    .toUpperCase() || undefined;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Back Button */}
      <View style={[styles.backButton, { top: insets.top + 12 }]}>
        <IconButton name="arrow-left" onPress={() => router.back()} />
      </View>
      
      {/* Hero Header */}
      <View
        style={[styles.hero, { backgroundColor: Design.colors.primary, paddingTop: insets.top + 12 }]}
      >
        {/* Decorative background shapes */}
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          <View style={[styles.pill, { top: 30, left: -30, opacity: 0.18 }]} />
          <View style={[styles.pill, { top: 90, right: -40, opacity: 0.12 }]} />
          <View style={[styles.pill, { bottom: 30, left: -20, opacity: 0.1 }]} />
          <View style={[styles.pill, { bottom: -10, right: -30, opacity: 0.16 }]} />
          <View style={[styles.diag, { top: 50, left: 60 }]} />
          <View style={[styles.diag, { top: 110, right: 50 }]} />
          <View style={[styles.diag, { bottom: 80, left: 40 }]} />
          <View style={[styles.diag, { bottom: 30, right: 30 }]} />
        </View>

        <View style={styles.heroContent}>
          <View style={styles.avatarCircle}>
            {initial ? (
              <ThemedText style={{ color: 'white', fontSize: 28, fontWeight: '700' }}>{initial}</ThemedText>
            ) : (
              <MaterialCommunityIcons name="account" size={32} color="#FFFFFF" />
            )}
          </View>
          <ThemedText type="title" style={{ color: 'white', textAlign: 'center', marginTop: 8 }}>
            {firstName ? `${firstName}'s Profile` : 'Profile Details'}
          </ThemedText>
          {building && room && (
            <ThemedText style={{ color: 'rgba(255,255,255,0.9)', textAlign: 'center' }}>
              {building} • Room {room}
            </ThemedText>
          )}
          {serverUser?.studentId && (
            <ThemedText style={{ color: 'rgba(255,255,255,0.9)', textAlign: 'center' }}>
              {serverUser.studentId}
            </ThemedText>
          )}
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cards}>
          {/* Identity Section */}
          <Card style={styles.cardWithIcon}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="account-box" size={24} color={Design.colors.primary} />
              <ThemedText type="subtitle" style={styles.sectionTitle}>Identity</ThemedText>
            </View>
            <View style={styles.fieldsGrid}>
              <Field label="Full name" value={fullName} icon="account" />
              <Field label="First name" value={firstName} icon="account-outline" />
              <Field label="Surname" value={serverUser?.surname} icon="card-account-details" />
              <Field label="Given names" value={serverUser?.lastname} icon="format-letter-case" />
              <Field label="Email" value={serverUser?.email} icon="email" />
            </View>
          </Card>

          {/* Residence Section */}
          <Card style={styles.cardWithIcon}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="home-city" size={24} color={Design.colors.primary} />
              <ThemedText type="subtitle" style={styles.sectionTitle}>Residence</ThemedText>
            </View>
            <View style={styles.fieldsGrid}>
              <Field label="Building" value={hall?.bldg_short_nam} icon="office-building" />
              <Field label="Room" value={hall?.bldg_apt_room_nbr} icon="door" />
              <Field label="Bed" value={hall?.bldg_room_bed_nbr} icon="bed" />
              <Field label="Floor" value={hall?.bldg_floor_nbr} icon="stairs" />
              <Field label="Room type" value={hall?.bldg_room_type_cde} icon="home-variant" />
              <Field label="Residence type" value={hall?.bldg_room_res_type_ind} icon="home-group" />
              <Field label="Extension" value={serverUser?.ext} icon="phone" />
            </View>
          </Card>

        </View>
      </ScrollView>
    </ThemedView>
  );
}

function Field({ label, value, icon }: { label: string; value?: string | number; icon?: string }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <View style={styles.fieldContainer}>
      {icon && (
        <MaterialCommunityIcons 
          name={icon as any} 
          size={18} 
          color={Design.colors.textSecondary} 
          style={styles.fieldIcon} 
        />
      )}
      <View style={styles.fieldContent}>
        <ThemedText style={styles.label}>{label}</ThemedText>
        <ThemedText style={styles.value}>{String(value)}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Design.colors.background,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  // Back button styles
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 20,
  },
  // Hero section styles
  hero: {
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  heroContent: {
    alignItems: 'center',
    gap: 6,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    ...Design.shadow.floating,
  },
  // Background decoration styles
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
    height: 120,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  // Content styles
  cards: {
    padding: 16,
    gap: 16,
  },
  cardWithIcon: {
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  sectionTitle: {
    color: Design.colors.textPrimary,
    fontWeight: '600',
  },
  fieldsGrid: {
    gap: 8,
  },
  // Field styles
  fieldContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  fieldIcon: {
    marginTop: 2,
  },
  fieldContent: {
    flex: 1,
    gap: 4,
  },
  label: {
    color: Design.colors.textSecondary,
    fontSize: Design.typography.sizes.caption,
    lineHeight: 16,
    fontWeight: '500',
  },
  value: {
    color: Design.colors.textPrimary,
    fontSize: Design.typography.sizes.body,
    lineHeight: 20,
    fontWeight: '400',
  },
});
