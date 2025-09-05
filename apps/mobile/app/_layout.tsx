import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

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
