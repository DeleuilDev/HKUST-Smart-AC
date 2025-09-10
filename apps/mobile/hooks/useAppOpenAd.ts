import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { adMobService } from '@/lib/admobService';

export interface AppOpenAdState {
  isInitialized: boolean;
  isLoading: boolean;
  isShowing: boolean;
  error: string | null;
}

export interface UseAppOpenAdOptions {
  /**
   * Whether to automatically show ads when the app becomes active
   * @default true
   */
  autoShow?: boolean;
  
  /**
   * Minimum time in milliseconds between ad shows
   * @default 300000 (5 minutes)
   */
  minIntervalMs?: number;
  
  /**
   * Whether to show ad on first app launch
   * @default true
   */
  showOnFirstLaunch?: boolean;
  
  /**
   * Whether to enable debug logging
   * @default __DEV__
   */
  debug?: boolean;
}

export function useAppOpenAd(options: UseAppOpenAdOptions = {}) {
  const {
    autoShow = true,
    minIntervalMs = 300000, // 5 minutes
    showOnFirstLaunch = true,
    debug = __DEV__
  } = options;

  const [state, setState] = useState<AppOpenAdState>({
    isInitialized: false,
    isLoading: false,
    isShowing: false,
    error: null
  });

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastAdShowTime = useRef<number>(0);
  const isFirstLaunch = useRef<boolean>(true);

  const log = useCallback((message: string, ...args: any[]) => {
    if (debug) {
      console.log(`[useAppOpenAd] ${message}`, ...args);
    }
  }, [debug]);

  /**
   * Initialize AdMob service
   */
  const initialize = useCallback(async () => {
    if (state.isInitialized) {
      log('Already initialized');
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      log('Initializing AdMob service...');
      
      await adMobService.initialize();
      
      setState(prev => ({ 
        ...prev, 
        isInitialized: true, 
        isLoading: false 
      }));
      
      log('AdMob service initialized successfully');
      
      // Show ad immediately on first launch if enabled
      if (showOnFirstLaunch && isFirstLaunch.current) {
        showAd(); // Launch immediately
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log('Failed to initialize AdMob service:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
    }
  }, [state.isInitialized, showOnFirstLaunch, log]);

  /**
   * Show App Open Ad
   */
  const showAd = useCallback(async (): Promise<boolean> => {
    if (!state.isInitialized) {
      log('AdMob not initialized, cannot show ad');
      return false;
    }

    if (state.isShowing) {
      log('Ad is already showing');
      return false;
    }

    // Check minimum interval
    const now = Date.now();
    const timeSinceLastAd = now - lastAdShowTime.current;
    
    if (lastAdShowTime.current > 0 && timeSinceLastAd < minIntervalMs) {
      log(`Too soon to show another ad. Wait ${Math.ceil((minIntervalMs - timeSinceLastAd) / 1000)}s more`);
      return false;
    }

    try {
      setState(prev => ({ ...prev, isShowing: true, error: null }));
      log('Attempting to show App Open Ad...');
      
      const success = await adMobService.showAppOpenAd();
      
      if (success) {
        lastAdShowTime.current = now;
        log('App Open Ad shown successfully');
      } else {
        log('Failed to show App Open Ad');
      }
      
      setState(prev => ({ ...prev, isShowing: false }));
      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log('Error showing App Open Ad:', error);
      setState(prev => ({ 
        ...prev, 
        isShowing: false, 
        error: errorMessage 
      }));
      return false;
    }
  }, [state.isInitialized, state.isShowing, minIntervalMs, log]);

  /**
   * Handle app state changes
   */
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    log(`App state changed: ${appStateRef.current} -> ${nextAppState}`);
    
    if (
      autoShow &&
      state.isInitialized &&
      appStateRef.current === 'background' &&
      nextAppState === 'active'
    ) {
      log('App returned from background, showing ad...');
      // Show ad immediately when returning from background
      showAd();
    }
    
    appStateRef.current = nextAppState;
    isFirstLaunch.current = false;
  }, [autoShow, state.isInitialized, showAd, log]);

  /**
   * Force reload ad
   */
  const reloadAd = useCallback(async () => {
    if (!state.isInitialized) {
      log('AdMob not initialized, cannot reload ad');
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      log('Reloading App Open Ad...');
      
      await adMobService.loadAppOpenAd();
      
      setState(prev => ({ ...prev, isLoading: false }));
      log('App Open Ad reloaded successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log('Failed to reload App Open Ad:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
    }
  }, [state.isInitialized, log]);

  /**
   * Get detailed ad status for debugging
   */
  const getAdStatus = useCallback(() => {
    if (!state.isInitialized) {
      return null;
    }
    
    return {
      ...adMobService.getAdStatus(),
      lastAdShowTime: lastAdShowTime.current,
      timeSinceLastAd: lastAdShowTime.current > 0 ? Date.now() - lastAdShowTime.current : 0,
      canShowAd: Date.now() - lastAdShowTime.current >= minIntervalMs,
    };
  }, [state.isInitialized, minIntervalMs]);

  // Set up app state listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);

  // Auto-initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      log('Cleaning up AdMob service...');
      adMobService.cleanup();
    };
  }, [log]);

  return {
    state,
    initialize,
    showAd,
    reloadAd,
    getAdStatus,
    
    // Convenience getters
    isInitialized: state.isInitialized,
    isLoading: state.isLoading,
    isShowing: state.isShowing,
    error: state.error,
  };
}
