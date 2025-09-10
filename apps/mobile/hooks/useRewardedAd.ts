import { useCallback, useState } from 'react';
import { adMobService, RewardedAdCallbacks } from '@/lib/admobService';

export interface RewardedAdState {
  isLoading: boolean;
  isShowing: boolean;
  error: string | null;
  isRewarded: boolean;
}

export interface UseRewardedAdOptions {
  /**
   * Whether to automatically reload ad after it's shown
   * @default true
   */
  autoReload?: boolean;
  
  /**
   * Whether to enable debug logging
   * @default __DEV__
   */
  debug?: boolean;
}

export function useRewardedAd(options: UseRewardedAdOptions = {}) {
  const {
    autoReload = true,
    debug = __DEV__
  } = options;

  const [state, setState] = useState<RewardedAdState>({
    isLoading: false,
    isShowing: false,
    error: null,
    isRewarded: false
  });

  const log = useCallback((message: string, ...args: any[]) => {
    if (debug) {
      console.log(`[useRewardedAd] ${message}`, ...args);
    }
  }, [debug]);

  /**
   * Load rewarded ad
   */
  const loadAd = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      log('Loading rewarded ad...');
      
      await adMobService.loadRewardedAd();
      
      setState(prev => ({ ...prev, isLoading: false }));
      log('Rewarded ad loaded successfully');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log('Failed to load rewarded ad:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
      return false;
    }
  }, [log]);

  /**
   * Show rewarded ad with promise-based reward tracking
   */
  const showAd = useCallback((): Promise<{ success: boolean; rewarded: boolean }> => {
    return new Promise((resolve) => {
      let rewarded = false;
      let adClosed = false;

      const callbacks: RewardedAdCallbacks = {
        onRewarded: (reward) => {
          log('Reward earned:', reward);
          rewarded = true;
          setState(prev => ({ ...prev, isRewarded: true }));
        },
        
        onAdClosed: () => {
          log('Rewarded ad closed');
          adClosed = true;
          setState(prev => ({ 
            ...prev, 
            isShowing: false 
          }));
          
          // Auto-reload if enabled
          if (autoReload) {
            loadAd().catch(console.error);
          }
          
          resolve({ success: true, rewarded });
        },
        
        onAdFailedToLoad: (error) => {
          log('Failed to load rewarded ad:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to load ad';
          setState(prev => ({ 
            ...prev, 
            isLoading: false, 
            error: errorMessage 
          }));
          resolve({ success: false, rewarded: false });
        },
        
        onAdFailedToShow: (error) => {
          log('Failed to show rewarded ad:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to show ad';
          setState(prev => ({ 
            ...prev, 
            isShowing: false, 
            error: errorMessage 
          }));
          resolve({ success: false, rewarded: false });
        }
      };

      setState(prev => ({ ...prev, isShowing: true, error: null, isRewarded: false }));
      log('Showing rewarded ad...');

      adMobService.showRewardedAd(callbacks).catch((error) => {
        log('Error in showRewardedAd:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to show ad';
        setState(prev => ({ 
          ...prev, 
          isShowing: false, 
          error: errorMessage 
        }));
        resolve({ success: false, rewarded: false });
      });
    });
  }, [log, autoReload, loadAd]);

  /**
   * Show ad and wait for reward (convenience method for Smart Mode)
   */
  const showAdForReward = useCallback(async (): Promise<boolean> => {
    log('Showing ad for reward...');
    const result = await showAd();
    return result.success && result.rewarded;
  }, [showAd, log]);

  /**
   * Check if ad is available
   */
  const isAdAvailable = useCallback((): boolean => {
    const status = adMobService.getAdStatus();
    return status.isRewardedAdAvailable;
  }, []);

  /**
   * Reset reward state
   */
  const resetReward = useCallback(() => {
    setState(prev => ({ ...prev, isRewarded: false }));
  }, []);

  /**
   * Get detailed ad status for debugging
   */
  const getAdStatus = useCallback(() => {
    return adMobService.getAdStatus();
  }, []);

  return {
    state,
    loadAd,
    showAd,
    showAdForReward,
    isAdAvailable,
    resetReward,
    getAdStatus,
    
    // Convenience getters
    isLoading: state.isLoading,
    isShowing: state.isShowing,
    error: state.error,
    isRewarded: state.isRewarded,
  };
}
