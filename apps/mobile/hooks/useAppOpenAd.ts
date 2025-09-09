import { useEffect } from 'react';
import { Platform } from 'react-native';

// Avoid importing the ads module at file init time; lazy-load in effect
const PROD_APP_OPEN_UNIT_ID = 'ca-app-pub-2750299952867090/7545970332'; // TODO: replace with your production unit id

export function useAppOpenAd(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;

    let cleanup: (() => void) | null = null;
    (async () => {
      try {
        const { AppOpenAd, AdEventType, TestIds } = await import('react-native-google-mobile-ads');
        const unitId = __DEV__ ? TestIds.APP_OPEN : PROD_APP_OPEN_UNIT_ID;
        const ad = AppOpenAd.createForAdRequest(unitId, {
          requestNonPersonalizedAdsOnly: false,
        });
        const onLoaded = () => ad.show();
        const onError = () => {};
        ad.addAdEventListener(AdEventType.LOADED, onLoaded);
        ad.addAdEventListener(AdEventType.ERROR, onError);
        ad.load();
        cleanup = () => ad.removeAllListeners();
      } catch {
        // Ads module not available (e.g., Expo Go): ignore
      }
    })();

    return () => {
      if (cleanup) cleanup();
    };
  }, [enabled]);
}
