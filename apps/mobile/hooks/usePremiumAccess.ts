import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// New single-use token key. We keep the old time-based key for migration.
const TOKEN_KEY = 'premiumStartToken';
const LEGACY_TIME_KEY = 'premiumUntil';

const PROD_REWARDED_UNIT_ID = 'ca-app-pub-2750299952867090/6176176208'; // TODO: replace with your production unit id

export function usePremiumAccess() {
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [adsAvailable, setAdsAvailable] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize Mobile Ads SDK once (lazy import to avoid crash on Expo Go)
    (async () => {
      try {
        const ads = await import('react-native-google-mobile-ads');
        await ads.default().initialize();
        setAdsAvailable(true);
      } catch {
        // native module not available — ignore in Expo Go
        setAdsAvailable(false);
      }
    })();
    // Load token and migrate any legacy time-based access to a single-use token
    (async () => {
      try {
        const [tokenStr, legacyStr] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(LEGACY_TIME_KEY),
        ]);
        const token = tokenStr === '1' || tokenStr === 'true';
        let migratedToken = token;
        const legacyUntil = Number.parseInt(legacyStr || '0', 10) || 0;
        if (!token && legacyUntil > Date.now()) {
          // Migrate old premium period to a single-use token
          migratedToken = true;
          try {
            await AsyncStorage.setItem(TOKEN_KEY, '1');
          } catch {}
        }
        setHasToken(migratedToken);
        // Best-effort: clear legacy key
        if (legacyStr) {
          try { await AsyncStorage.removeItem(LEGACY_TIME_KEY); } catch {}
        }
      } catch {
        setHasToken(false);
      }
    })();
  }, []);

  // Refresh access on app foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // No-op for token; ensure state sync from storage in case of external changes
        (async () => {
          try {
            const tokenStr = await AsyncStorage.getItem(TOKEN_KEY);
            setHasToken(tokenStr === '1' || tokenStr === 'true');
          } catch {}
        })();
      }
    });
    return () => sub.remove();
  }, []);

  const hasAccess = hasToken;

  const unlockWithAd = useCallback(() => {
    if (Platform.OS === 'web') return Promise.resolve(false);
    if (!adsAvailable) {
      setLastError('Ads module unavailable (use development build).');
      return Promise.resolve(false);
    }
    setLoading(true);
    let granted = false;

    return new Promise<boolean>((resolve) => {
      (async () => {
        try {
          // Ensure SDK is initialized in case calling site mounted before init completed
          const ads = await import('react-native-google-mobile-ads');
          try { await ads.default().initialize(); } catch {}
          const { RewardedAd, RewardedAdEventType, AdEventType, TestIds } = ads as any;
          const unitId = __DEV__ ? TestIds.REWARDED : PROD_REWARDED_UNIT_ID;
          const ad = RewardedAd.createForAdRequest(unitId, {
            requestNonPersonalizedAdsOnly: false,
          });

          const cleanup = () => ad.removeAllListeners();

          // For RewardedAd, use RewardedAdEventType.LOADED (not AdEventType.LOADED)
          ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
            ad.show();
          });

          ad.addAdEventListener(AdEventType.ERROR, (err: any) => {
            cleanup();
            setLoading(false);
            const msg = err?.message || err?.toString?.() || 'Ad failed to load';
            setLastError(String(msg));
            resolve(false);
          });

          ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, async () => {
            granted = true;
            setHasToken(true);
            try {
              await AsyncStorage.setItem(TOKEN_KEY, '1');
            } catch {}
          });

          ad.addAdEventListener(AdEventType.CLOSED, () => {
            cleanup();
            setLoading(false);
            resolve(granted);
          });

          ad.load();
        } catch (e: any) {
          // Surface the actual error to aid debugging instead of a generic message
          setLoading(false);
          const msg = e?.message || e?.toString?.() || 'Ads error';
          setLastError(String(msg));
          resolve(false);
        }
      })();
    });
  }, [adsAvailable]);

  const clearAccess = useCallback(async () => {
    setHasToken(false);
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch {}
  }, []);

  return { hasAccess, unlockWithAd, loading, clearAccess, adsAvailable, lastError };
}
