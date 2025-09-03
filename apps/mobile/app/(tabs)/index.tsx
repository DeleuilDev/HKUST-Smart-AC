import { Image } from 'expo-image';
import { Platform, StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { getAuth } from '@/lib/auth';

function ButtonLike(props: { title: string; onPress: () => void }) {
  return (
    <ThemedView style={styles.button}>
      <ThemedText type="link" onPress={props.onPress}>{props.title}</ThemedText>
    </ThemedView>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [hasToken, setHasToken] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const auth = await getAuth();
      setHasToken(!!auth?.token || !!auth?.raw);
    })();
  }, []);

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">HKUST Smart AC</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Sign in</ThemedText>
        <ThemedText>
          Sign in via CAS to retrieve your access token.
        </ThemedText>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <ButtonLike title="Sign in" onPress={() => router.push('/login')} />
          {hasToken && <ButtonLike title="View Profile" onPress={() => router.push('/profile')} />}
        </View>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.08)'
  }
});
