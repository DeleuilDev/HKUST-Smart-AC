import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAppOpenAd } from '@/hooks/useAppOpenAd';

import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'ios') {
          // Lazy import to avoid requiring native module on Android or Expo Go
          const mod = await import('expo-tracking-transparency');
          await mod.requestTrackingPermissionsAsync();
        }
      } catch {}
      try {
        // Lazy import to avoid crash if native ads module isn't present (Expo Go)
        const ads = await import('react-native-google-mobile-ads');
        await ads.default().initialize();
      } catch {}
    })();
  }, []);

  // Show an App Open Ad at startup (dev uses test ad unit)
  useAppOpenAd(true);

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
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// Ensure we always start from the index route instead of restoring a previous screen (e.g., /login) on Android.
export const unstable_settings = {
  initialRouteName: 'index',
} as const;
