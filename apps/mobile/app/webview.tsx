import React, { useMemo } from 'react';
import { ActivityIndicator, SafeAreaView } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

export default function InAppWebView() {
  const params = useLocalSearchParams<{ url?: string; title?: string }>();
  const uri = useMemo(() => (params?.url && typeof params.url === 'string') ? params.url : 'about:blank', [params?.url]);
  const title = typeof params?.title === 'string' && params.title ? params.title : 'Browser';

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title, headerShown: true }} />
      <WebView
        originWhitelist={["*"]}
        source={{ uri }}
        startInLoadingState
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        userAgent={'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1'}
        renderLoading={() => (
          <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
            <ThemedText style={{ marginTop: 8 }}>Loading…</ThemedText>
          </SafeAreaView>
        )}
      />
    </ThemedView>
  );
}

