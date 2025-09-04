import React from 'react';
import { View, StyleSheet } from 'react-native';
import Card from '@/components/ui/Card';
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import { ThemedText } from '@/components/ThemedText';
import { Design } from '@/constants/Design';
import PrimaryButton from '@/components/ui/PrimaryButton';
import IconButton from '@/components/ui/IconButton';
import { useRouter } from 'expo-router';

export default function MinutesCard({ balance, totalPaidInMinute }: { balance?: number | null; totalPaidInMinute?: number | null }) {
  const router = useRouter();
  const remaining = typeof balance === 'number' && isFinite(balance) ? Math.max(0, balance) : 0;
  const cap = typeof totalPaidInMinute === 'number' && isFinite(totalPaidInMinute) && totalPaidInMinute > 0 ? totalPaidInMinute : 0;
  const pct = cap > 0 ? Math.max(0, Math.min(1, remaining / cap)) : 0;
  const used = cap > 0 ? Math.max(0, cap - remaining) : 0;
  const TOPUP_URL = 'https://w5.ab.ust.hk/njggt/app/top-up/billing-cycle';
  const openTopUp = () => { router.push({ pathname: '/webview', params: { url: TOPUP_URL, title: 'Top up' } }); };
  const openTopUpHistory = () => { router.push('/topup-history'); };

  return (
    <Card style={[styles.card, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECECEC' }]}>
      <View style={styles.row}>
        <View style={{ alignItems: 'center' }}>
          <AnimatedCircularProgress
            size={110}
            width={12}
            fill={pct * 100}
            tintColor={Design.colors.primary}
            backgroundColor={'#ECEAFD'}
            lineCap="round"
            rotation={0}
          >
            {() => (
              <View style={styles.centerLabel}>
                <ThemedText style={styles.minutesValue}>{cap > 0 ? Math.round(remaining) : '—'}</ThemedText>
                <ThemedText style={styles.minutesUnit}>min</ThemedText>
              </View>
            )}
          </AnimatedCircularProgress>
        </View>

        <View style={{ flex: 1, gap: 6 }}>
          <ThemedText type="subtitle">Remaining Minutes</ThemedText>
          <ThemedText style={{ color: Design.colors.textSecondary }}>
            {cap > 0 ? Math.round(pct * 100) : '—'}% of purchased credit remaining
          </ThemedText>
          <View style={styles.actionsRow}>
            <PrimaryButton title="Top up" onPress={openTopUp} appearance="solid" variant="primary" size="sm" iconLeft="credit-card-plus-outline" />
            <IconButton name="ticket-confirmation-outline" onPress={openTopUpHistory} color={Design.colors.textPrimary} background={'#F1F1F4'} />
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Design.spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Design.spacing.lg,
  },
  actionsRow: { marginTop: Design.spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  centerLabel: { alignItems: 'center' },
  minutesValue: { fontSize: 22, fontWeight: '700', color: Design.colors.textPrimary },
  minutesUnit: { fontSize: 12, color: Design.colors.textSecondary },
  
  
});
