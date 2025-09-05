import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Card from '@/components/ui/Card';
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import { ThemedText } from '@/components/ThemedText';
import { Design } from '@/constants/Design';
import PrimaryButton from '@/components/ui/PrimaryButton';
import IconButton from '@/components/ui/IconButton';
import { useRouter } from 'expo-router';

type DisplayFormat = 'minutes' | 'hours' | 'percentage';

export default function MinutesCard({ balance, totalPaidInMinute }: { balance?: number | null; totalPaidInMinute?: number | null }) {
  const router = useRouter();
  const [displayFormat, setDisplayFormat] = useState<DisplayFormat>('minutes');
  
  const remaining = typeof balance === 'number' && isFinite(balance) ? Math.max(0, balance) : 0;
  const cap = typeof totalPaidInMinute === 'number' && isFinite(totalPaidInMinute) && totalPaidInMinute > 0 ? totalPaidInMinute : 0;
  const pct = cap > 0 ? Math.max(0, Math.min(1, remaining / cap)) : 0;
  const used = cap > 0 ? Math.max(0, cap - remaining) : 0;
  const TOPUP_URL = 'https://w5.ab.ust.hk/njggt/app/top-up/billing-cycle';
  const openTopUp = () => { router.push({ pathname: '/webview', params: { url: TOPUP_URL, title: 'Top up' } }); };
  const openTopUpHistory = () => { router.push('/topup-history'); };

  // Fonction pour formater l'affichage selon le format sélectionné
  const formatDisplay = () => {
    if (cap <= 0) return { value: '—', isLong: false, isMultiLine: false };
    
    switch (displayFormat) {
      case 'minutes':
        return { 
          value: `${Math.round(remaining)} min`, 
          isLong: false,
          isMultiLine: false
        };
      case 'hours':
        const hours = Math.floor(remaining / 60);
        const mins = Math.round(remaining % 60);
        if (hours === 0) {
          return { 
            value: `${mins}m`, 
            isLong: false,
            isMultiLine: false
          };
        }
        return { 
          value: `${hours}h\n${mins}m`, 
          isLong: true,
          isMultiLine: true
        };
      case 'percentage':
        return { 
          value: `${Math.round(pct * 100)}%`, 
          isLong: false,
          isMultiLine: false
        };
      default:
        return { 
          value: `${Math.round(remaining)} min`, 
          isLong: false,
          isMultiLine: false
        };
    }
  };

  // Fonction pour basculer entre les formats
  const toggleDisplayFormat = () => {
    setDisplayFormat(prev => {
      switch (prev) {
        case 'minutes': return 'hours';
        case 'hours': return 'percentage';
        case 'percentage': return 'minutes';
        default: return 'minutes';
      }
    });
  };

  return (
    <Card style={[styles.card, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECECEC' }]}>
      <View style={styles.row}>
        <View style={{ alignItems: 'center' }}>
          <Pressable onPress={toggleDisplayFormat} style={styles.graphContainer}>
            <AnimatedCircularProgress
              size={110}
              width={12}
              fill={pct * 100}
              tintColor={Design.colors.primary}
              backgroundColor={'#ECEAFD'}
              lineCap="round"
              rotation={0}
            >
              {() => {
                const { value, isLong, isMultiLine } = formatDisplay();
                return (
                  <View style={styles.centerLabel}>
                    <ThemedText style={[
                      styles.circleText,
                      isLong ? styles.longText : styles.normalText,
                      isMultiLine && styles.multiLineText
                    ]}>{value}</ThemedText>
                  </View>
                );
              }}
            </AnimatedCircularProgress>
          </Pressable>
        </View>

        <View style={{ flex: 1, gap: 6 }}>
          <ThemedText type="subtitle">Remaining Minutes</ThemedText>
          <ThemedText style={{ color: Design.colors.textSecondary, fontSize: 11 }}>
            Tap the circle to switch display format
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
  centerLabel: { 
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 12, // Marges horizontales pour éviter que le texte touche les bords
    paddingVertical: 8, // Marges verticales
  },
  circleText: {
    fontWeight: '700',
    color: Design.colors.textPrimary,
    textAlign: 'center',
    lineHeight: undefined, // Laisser le système calculer
  },
  normalText: {
    fontSize: 20, // Taille normale pour textes courts
  },
  longText: {
    fontSize: 16, // Taille réduite pour textes longs (ex: "2h 15m")
  },
  multiLineText: {
    lineHeight: 18, // Espacement entre les lignes pour le mode heures
    fontSize: 18, // Taille adaptée pour deux lignes
  },
  graphContainer: {
    borderRadius: 60,
    // Feedback visuel subtil pour indiquer que c'est cliquable
  },
});
