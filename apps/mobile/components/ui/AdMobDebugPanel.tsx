import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppOpenAd } from '@/hooks/useAppOpenAd';
import { useRewardedAd } from '@/hooks/useRewardedAd';

interface AdMobDebugPanelProps {
  visible?: boolean;
}

export function AdMobDebugPanel({ visible = __DEV__ }: AdMobDebugPanelProps) {
  const { isInitialized, isLoading, isShowing, error, showAd, reloadAd, getAdStatus } = useAppOpenAd();
  const { showAdForReward, isLoading: rewardedLoading, error: rewardedError } = useRewardedAd();
  const [adStatus, setAdStatus] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(visible);

  useEffect(() => {
    if (isInitialized) {
      const interval = setInterval(() => {
        setAdStatus(getAdStatus());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isInitialized, getAdStatus]);

  if (!visible || !isVisible) {
    return (
      visible && (
        <TouchableOpacity
          style={styles.minimizedContainer}
          onPress={() => setIsVisible(true)}
        >
          <Text style={styles.minimizedText}>🐛</Text>
        </TouchableOpacity>
      )
    );
  }

  const formatTime = (timestamp: number) => {
    if (timestamp === 0) return 'Never';
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (ms: number) => {
    if (ms === 0) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AdMob Debug Panel</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => setIsVisible(false)}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status</Text>
        <Text style={styles.statusText}>
          Initialized: {isInitialized ? '✅' : '❌'}
        </Text>
        <Text style={styles.statusText}>
          Loading: {isLoading ? '🔄' : '✅'}
        </Text>
        <Text style={styles.statusText}>
          Showing: {isShowing ? '📺' : '✅'}
        </Text>
        {error && (
          <Text style={styles.errorText}>
            App Open Error: {error}
          </Text>
        )}
        {rewardedError && (
          <Text style={styles.errorText}>
            Rewarded Error: {rewardedError}
          </Text>
        )}
      </View>

      {adStatus && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Open Ad</Text>
          <Text style={styles.statusText}>
            Available: {adStatus.isAdAvailable ? '✅' : '❌'}
          </Text>
          <Text style={styles.statusText}>
            Load Time: {formatTime(adStatus.loadTime)}
          </Text>
          <Text style={styles.statusText}>
            Since Load: {formatDuration(adStatus.timeSinceLoad)}
          </Text>
        </View>
      )}

      {adStatus && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rewarded Ad</Text>
          <Text style={styles.statusText}>
            Loading: {rewardedLoading ? '🔄' : '✅'}
          </Text>
          <Text style={styles.statusText}>
            Available: {adStatus.isRewardedAdAvailable ? '✅' : '❌'}
          </Text>
          <Text style={styles.statusText}>
            Load Time: {formatTime(adStatus.rewardedLoadTime)}
          </Text>
          <Text style={styles.statusText}>
            Since Load: {formatDuration(adStatus.timeSinceRewardedLoad)}
          </Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.showButton]}
          onPress={showAd}
          disabled={isShowing || !isInitialized}
        >
          <Text style={styles.buttonText}>App Open</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.rewardedButton]}
          onPress={() => showAdForReward()}
          disabled={rewardedLoading || !isInitialized}
        >
          <Text style={styles.buttonText}>Rewarded</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 15,
    borderRadius: 10,
    maxWidth: 250,
    zIndex: 1000,
  },
  minimizedContainer: {
    position: 'absolute',
    top: 100,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 20,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimizedText: {
    fontSize: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    color: '#ffcc00',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    marginBottom: 2,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
    marginBottom: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 2,
  },
  showButton: {
    backgroundColor: '#4CAF50',
  },
  reloadButton: {
    backgroundColor: '#2196F3',
  },
  rewardedButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
