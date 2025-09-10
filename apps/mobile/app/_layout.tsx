import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppOpenAd } from '@/hooks/useAppOpenAd';
import { AdMobDebugPanel } from '@/components/ui/AdMobDebugPanel';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Initialize App Open Ads with 5-minute interval
  const { isInitialized, error } = useAppOpenAd({
    autoShow: true,
    minIntervalMs: 150000, // 5 minutes between ads (5 * 60 * 1000 = 300000ms)
    showOnFirstLaunch: true,
    debug: __DEV__
  });

  // Log AdMob status in development
  if (__DEV__ && isInitialized) {
    console.log('[App] AdMob initialized successfully');
  }
  if (__DEV__ && error) {
    console.error('[App] AdMob initialization error:', error);
  }

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ presentation: 'modal', animation: 'slide_from_bottom', title: 'CAS Login' }} />
          <Stack.Screen name="webview" options={{ presentation: 'modal', animation: 'slide_from_bottom', title: 'Browser' }} />
          <Stack.Screen name="topup-history" options={{ title: 'Top-up History' }} />
        <Stack.Screen name="profile" options={{ headerShown: true, title: 'Profile', headerBackVisible: false }} />
        <Stack.Screen name="profile-details" options={{ headerShown: true, title: 'Profile' }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
        
        {/* Debug panel for development */}
        {__DEV__ && <AdMobDebugPanel />}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// Ensure we always start from the index route instead of restoring a previous screen (e.g., /login) on Android.
export const unstable_settings = {
  initialRouteName: 'index',
} as const;
