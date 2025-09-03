import React, { useMemo, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, SafeAreaView, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Stack, useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { AC_APP_ENTRY_URL } from '@/constants/api';
import { extractToken, setAuth } from '@/lib/auth';
import { backendFetch, SessionResponse } from '@/lib/backend';

const injection = `(() => {
  try {
    const RNW = window.ReactNativeWebView;
    if (!RNW) return;
    if (window.__CAS_HOOKED__) return;
    window.__CAS_HOOKED__ = true;

    const matchesAuth = (u) => {
      try { const s = String(u || ''); return s.includes('/njggt/api/app/auth/cas'); } catch { return false; }
    };

    // Patch fetch
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
      const res = await origFetch.apply(this, args);
      try {
        const req = args[0];
        const url = (typeof req === 'string') ? req : (req && req.url);
        const method = (args[1] && args[1].method) || (req && req.method) || 'GET';
        if (url && matchesAuth(url) && String(method).toUpperCase() === 'POST') {
          const clone = res.clone();
          clone.text().then((txt) => {
            try {
              RNW.postMessage(JSON.stringify({ __casAuth: true, via: 'fetch', url, body: txt }));
            } catch (e) {}
          });
        }
      } catch (e) { RNW.postMessage(JSON.stringify({ __console: true, level: 'warn', args: ['fetch hook error', String(e)] })); }
      return res;
    };

    // Patch XHR
    const OrigXHR = window.XMLHttpRequest;
    function PatchedXHR() {
      const xhr = new OrigXHR();
      let url = '';
      let method = 'GET';
      const origOpen = xhr.open;
      xhr.open = function(m, u, ...rest) {
        method = m; url = u; return origOpen.call(xhr, m, u, ...rest);
      };
      xhr.addEventListener('loadend', function() {
        try {
          const finalUrl = (xhr.responseURL || url) || '';
          if (matchesAuth(finalUrl) && String(method).toUpperCase() === 'POST' && xhr.status >= 200 && xhr.status < 300) {
            const body = typeof xhr.responseText === 'string' ? xhr.responseText : '';
            RNW.postMessage(JSON.stringify({ __casAuth: true, via: 'xhr', url: finalUrl, body }));
          }
        } catch (e) { RNW.postMessage(JSON.stringify({ __console: true, level: 'warn', args: ['xhr hook error', String(e)] })); }
      });
      return xhr;
    }
    window.XMLHttpRequest = PatchedXHR;

    // Signal ready
    RNW.postMessage(JSON.stringify({ __console: true, level: 'log', args: ['[CAS] hooks injected'] }));
  } catch (e) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ __console: true, level: 'error', args: ['[CAS] injection error', String(e)] })); } catch (__) {}
  }
})();`;

export default function LoginScreen() {
  const router = useRouter();
  const webRef = useRef<WebView>(null);
  const [captured, setCaptured] = useState(false);
  const [lastUrl, setLastUrl] = useState<string>('');

  const source = useMemo(() => ({ uri: AC_APP_ENTRY_URL }), []);

  const onMessage = useCallback(async (e: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data && data.__console) {
        const { level, args } = data;
        // Only forward our tagged CAS messages to avoid noise
        const text = Array.isArray(args) ? args.join(' ') : String(args);
        if (String(text).includes('[CAS]')) {
          if (level === 'error') console.error('[WebView]', ...(args || []));
          else if (level === 'warn') console.warn('[WebView]', ...(args || []));
          else console.log('[WebView]', ...(args || []));
        }
      }
      if (data && data.__casAuth && !captured) {
        console.log('[CAS] auth intercepted via', data.via, 'url=', data.url);
        setCaptured(true);
        let parsed: any = null;
        try { parsed = JSON.parse(data.body); } catch { parsed = { rawText: data.body }; }
        let token = extractToken(parsed) || parsed?.data?.auth?.token;
        try {
          const sid = parsed?.data?.student?.student_id || parsed?.data?.student?.id;
          if (token) console.log('[CAS] token found:', token);
          if (sid) console.log('[CAS] student:', sid);
        } catch {}
        // Create backend session to know if user is new/existing
        let session: SessionResponse | null = null;
        try {
          const res = await backendFetch('/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ casPayload: parsed }),
          });
          const txt = await res.text();
          session = JSON.parse(txt);
        } catch (e) {
          console.warn('Failed to create backend session:', e);
        }

        await setAuth({ token, raw: parsed, ...(session ? { server: session } : {}) });
        if (session?.isNew) {
          router.replace('/welcome-new');
        } else {
          router.replace('/(tabs)');
        }
      }
    } catch (err) {
      console.warn('onMessage parse error', err);
    }
  }, [captured, router]);

  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'CAS Login', headerShown: true }} />
      {!captured && (
        <WebView
          ref={webRef}
          originWhitelist={["*"]}
          source={source}
          onMessage={onMessage}
          injectedJavaScript={injection}
          injectedJavaScriptBeforeContentLoaded={injection}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          startInLoadingState
          setSupportMultipleWindows={false}
          onLoadStart={(e) => { setLastUrl(e.nativeEvent.url); console.log('WebView load start:', e.nativeEvent.url); }}
          onLoadEnd={(e) => { console.log('WebView load end:', e.nativeEvent.url); }}
          onHttpError={(e) => { console.warn('WebView HTTP error:', e.nativeEvent.statusCode, e.nativeEvent.description); }}
          onError={(e) => { console.error('WebView error:', e.nativeEvent); }}
          onNavigationStateChange={(nav) => { setLastUrl(nav.url); console.log('WebView nav:', nav.url); }}
          userAgent={'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1'}
          onShouldStartLoadWithRequest={(req) => {
            // Always allow navigation within WebView
            if (req?.url) setLastUrl(req.url);
            return true;
          }}
          renderLoading={() => (
            <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator />
              <ThemedText style={{ marginTop: 8 }}>Loading CAS portal…</ThemedText>
            </SafeAreaView>
          )}
        />
      )}
      {captured && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
          <ThemedText style={{ marginTop: 8 }}>Retrieving token…</ThemedText>
        </View>
      )}
    </ThemedView>
  );
}
