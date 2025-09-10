import { Platform } from 'react-native';
import mobileAds, { AppOpenAd, RewardedAd, AdEventType, TestIds, RewardedAdEventType } from 'react-native-google-mobile-ads';

// AdMob App Open Ad Unit IDs
const ANDROID_APP_OPEN_UNIT_ID = 'ca-app-pub-2750299952867090/7545970332';
const IOS_APP_OPEN_UNIT_ID = ''; // Add iOS unit ID when available

// AdMob Rewarded Ad Unit IDs
const ANDROID_REWARDED_UNIT_ID = 'ca-app-pub-2750299952867090/6176176208';
const IOS_REWARDED_UNIT_ID = ''; // Add iOS unit ID when available

// For testing purposes
const APP_OPEN_UNIT_ID = __DEV__ 
  ? TestIds.APP_OPEN 
  : Platform.OS === 'android' 
    ? ANDROID_APP_OPEN_UNIT_ID 
    : IOS_APP_OPEN_UNIT_ID;

const REWARDED_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : Platform.OS === 'android'
    ? ANDROID_REWARDED_UNIT_ID
    : IOS_REWARDED_UNIT_ID;

export interface AdMobServiceConfig {
  maxLoadRetryCount: number;
  loadTimeoutMs: number;
  showTimeoutMs: number;
}

export interface RewardedAdCallbacks {
  onRewarded?: (reward: { type: string; amount: number }) => void;
  onAdClosed?: () => void;
  onAdFailedToLoad?: (error: any) => void;
  onAdFailedToShow?: (error: any) => void;
}

export class AdMobService {
  private static instance: AdMobService;
  private appOpenAd: AppOpenAd | null = null;
  private rewardedAd: RewardedAd | null = null;
  private isLoadingAd = false;
  private isShowingAd = false;
  private isLoadingRewardedAd = false;
  private isShowingRewardedAd = false;
  private loadTime = 0;
  private rewardedLoadTime = 0;
  private config: AdMobServiceConfig;
  private rewardedCallbacks: RewardedAdCallbacks = {};

  // Ad is considered expired after 4 hours
  private readonly AD_EXPIRY_DURATION_MS = 4 * 60 * 60 * 1000;

  private constructor(config: AdMobServiceConfig = {
    maxLoadRetryCount: 3,
    loadTimeoutMs: 30000,
    showTimeoutMs: 5000
  }) {
    this.config = config;
  }

  public static getInstance(config?: AdMobServiceConfig): AdMobService {
    if (!AdMobService.instance) {
      AdMobService.instance = new AdMobService(config);
    }
    return AdMobService.instance;
  }

  /**
   * Initialize AdMob SDK
   */
  public async initialize(): Promise<void> {
    try {
      console.log('[AdMob] Initializing AdMob SDK...');
      await mobileAds().initialize();
      console.log('[AdMob] AdMob SDK initialized successfully');
      
      // Pre-load first ad and show it immediately
      await this.loadAppOpenAd();
      await this.showAppOpenAd();
      
      // Pre-load rewarded ad for smart mode
      await this.loadRewardedAd();
    } catch (error) {
      console.error('[AdMob] Failed to initialize AdMob SDK:', error);
      throw error;
    }
  }

  /**
   * Load App Open Ad
   */
  public async loadAppOpenAd(retryCount = 0): Promise<void> {
    if (this.isLoadingAd) {
      console.log('[AdMob] Ad is already loading, skipping...');
      return;
    }

    if (this.isAdAvailable()) {
      console.log('[AdMob] Ad is already loaded and not expired');
      return;
    }

    try {
      this.isLoadingAd = true;
      console.log('[AdMob] Loading App Open Ad...');

      // Create new AppOpenAd instance
      this.appOpenAd = AppOpenAd.createForAdRequest(APP_OPEN_UNIT_ID, {
        requestNonPersonalizedAdsOnly: false,
        keywords: ['test'] // Ajout de keywords pour augmenter les chances de recevoir des pubs test
      });

      // Set up event listeners before loading
      this.setupAdEventListeners();

      // Load the ad with timeout
      await Promise.race([
        new Promise<void>((resolve) => {
          // Add specific load listener
          this.appOpenAd?.addAdEventListener(AdEventType.LOADED, () => {
            console.log('[AdMob] Ad loaded event received');
            resolve();
          });
          // Start loading
          this.appOpenAd?.load();
        }),
        this.createTimeout(this.config.loadTimeoutMs, 'Ad load timeout')
      ]);

      this.loadTime = Date.now();
      console.log('[AdMob] App Open Ad loaded successfully and ready to show');
    } catch (error) {
      console.error('[AdMob] Failed to load App Open Ad:', error);
      
      // Retry logic with shorter delay
      if (retryCount < this.config.maxLoadRetryCount) {
        console.log(`[AdMob] Retrying ad load (${retryCount + 1}/${this.config.maxLoadRetryCount})...`);
        await this.delay(500); // Reduced delay to 500ms
        return this.loadAppOpenAd(retryCount + 1);
      }
      
      throw error;
    } finally {
      this.isLoadingAd = false;
    }
  }

  /**
   * Show App Open Ad
   */
  public async showAppOpenAd(): Promise<boolean> {
    if (this.isShowingAd) {
      console.log('[AdMob] Ad is already showing');
      return false;
    }

    if (!this.isAdAvailable()) {
      console.log('[AdMob] No ad available to show');
      await this.loadAppOpenAd(); // Pre-load for next time
      return false;
    }

    try {
      this.isShowingAd = true;
      console.log('[AdMob] Showing App Open Ad...');

      await Promise.race([
        this.appOpenAd!.show(),
        this.createTimeout(this.config.showTimeoutMs, 'Ad show timeout')
      ]);

      return true;
    } catch (error) {
      console.error('[AdMob] Failed to show App Open Ad:', error);
      return false;
    }
  }

  /**
   * Check if ad is available and not expired
   */
  private isAdAvailable(): boolean {
    if (!this.appOpenAd || this.loadTime === 0) {
      return false;
    }

    const now = Date.now();
    const timeSinceLoad = now - this.loadTime;
    
    if (timeSinceLoad > this.AD_EXPIRY_DURATION_MS) {
      console.log('[AdMob] Ad has expired, need to load new one');
      return false;
    }

    return true;
  }

  /**
   * Load Rewarded Ad for Smart Mode
   */
  public async loadRewardedAd(retryCount = 0): Promise<void> {
    if (this.isLoadingRewardedAd) {
      console.log('[AdMob] Rewarded ad is already loading, skipping...');
      return;
    }

    if (this.isRewardedAdAvailable()) {
      console.log('[AdMob] Rewarded ad is already loaded and not expired');
      return;
    }

    try {
      this.isLoadingRewardedAd = true;
      console.log('[AdMob] Loading Rewarded Ad for Smart Mode...');

      // Create new RewardedAd instance
      this.rewardedAd = RewardedAd.createForAdRequest(REWARDED_UNIT_ID, {
        requestNonPersonalizedAdsOnly: false,
        keywords: ['smart', 'mode', 'energy'] // Keywords related to smart mode
      });

      // Set up event listeners before loading
      this.setupRewardedAdEventListeners();

      // Load the ad with timeout
      await Promise.race([
        new Promise<void>((resolve) => {
          // Add specific load listener
          this.rewardedAd?.addAdEventListener(RewardedAdEventType.LOADED, () => {
            console.log('[AdMob] Rewarded ad loaded event received');
            resolve();
          });
          // Start loading
          this.rewardedAd?.load();
        }),
        this.createTimeout(this.config.loadTimeoutMs, 'Rewarded ad load timeout')
      ]);

      this.rewardedLoadTime = Date.now();
      console.log('[AdMob] Rewarded Ad loaded successfully and ready to show');
    } catch (error) {
      console.error('[AdMob] Failed to load Rewarded Ad:', error);
      
      // Retry logic with shorter delay
      if (retryCount < this.config.maxLoadRetryCount) {
        console.log(`[AdMob] Retrying rewarded ad load (${retryCount + 1}/${this.config.maxLoadRetryCount})...`);
        await this.delay(500);
        return this.loadRewardedAd(retryCount + 1);
      }
      
      throw error;
    } finally {
      this.isLoadingRewardedAd = false;
    }
  }

  /**
   * Show Rewarded Ad for Smart Mode
   */
  public async showRewardedAd(callbacks: RewardedAdCallbacks = {}): Promise<boolean> {
    if (this.isShowingRewardedAd) {
      console.log('[AdMob] Rewarded ad is already showing');
      return false;
    }

    if (!this.isRewardedAdAvailable()) {
      console.log('[AdMob] No rewarded ad available to show');
      try {
        await this.loadRewardedAd(); // Pre-load for next time
      } catch (error) {
        console.error('[AdMob] Failed to pre-load rewarded ad:', error);
      }
      if (callbacks.onAdFailedToShow) {
        callbacks.onAdFailedToShow(new Error('No ad available'));
      }
      return false;
    }

    try {
      this.isShowingRewardedAd = true;
      console.log('[AdMob] Showing Rewarded Ad for Smart Mode...');

      // Store callbacks for event listeners
      this.rewardedCallbacks = callbacks;

      await Promise.race([
        this.rewardedAd!.show(),
        this.createTimeout(this.config.showTimeoutMs, 'Rewarded ad show timeout')
      ]);

      return true;
    } catch (error) {
      console.error('[AdMob] Failed to show Rewarded Ad:', error);
      this.isShowingRewardedAd = false;
      if (callbacks.onAdFailedToShow) {
        callbacks.onAdFailedToShow(error);
      }
      return false;
    }
  }

  /**
   * Check if rewarded ad is available and not expired
   */
  private isRewardedAdAvailable(): boolean {
    if (!this.rewardedAd || this.rewardedLoadTime === 0) {
      return false;
    }

    const now = Date.now();
    const timeSinceLoad = now - this.rewardedLoadTime;
    
    if (timeSinceLoad > this.AD_EXPIRY_DURATION_MS) {
      console.log('[AdMob] Rewarded ad has expired, need to load new one');
      return false;
    }

    return true;
  }

  /**
   * Set up event listeners for the ad
   */
  private setupAdEventListeners(): void {
    if (!this.appOpenAd) return;

    this.appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
      console.log('[AdMob] App Open Ad loaded, attempting to show...');
      // Try to show the ad immediately after it's loaded
      this.showAppOpenAd().catch(error => {
        console.error('[AdMob] Failed to show ad after load:', error);
      });
    });

    this.appOpenAd.addAdEventListener(AdEventType.ERROR, (error) => {
      console.error('[AdMob] App Open Ad error:', error);
      // Reset state on error
      this.isShowingAd = false;
      this.isLoadingAd = false;
      // Try to load a new ad after error
      setTimeout(() => this.loadAppOpenAd(), 1000);
    });

    this.appOpenAd.addAdEventListener(AdEventType.OPENED, () => {
      console.log('[AdMob] App Open Ad opened successfully');
      this.isShowingAd = true;
    });

    this.appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('[AdMob] App Open Ad closed');
      this.isShowingAd = false;
      this.appOpenAd = null;
      this.loadTime = 0;
      // Pre-load next ad immediately
      this.loadAppOpenAd().catch(console.error);
    });

    this.appOpenAd.addAdEventListener(AdEventType.CLICKED, () => {
      console.log('[AdMob] App Open Ad clicked');
    });
  }

  /**
   * Set up event listeners for rewarded ads
   */
  private setupRewardedAdEventListeners(): void {
    if (!this.rewardedAd) return;

    this.rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
      console.log('[AdMob] Rewarded ad loaded successfully');
    });

    this.rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
      console.log('[AdMob] Rewarded ad reward earned:', reward);
      if (this.rewardedCallbacks.onRewarded) {
        this.rewardedCallbacks.onRewarded(reward);
      }
    });

    this.rewardedAd.addAdEventListener(AdEventType.ERROR, (error) => {
      console.error('[AdMob] Rewarded ad error:', error);
      this.isShowingRewardedAd = false;
      this.isLoadingRewardedAd = false;
      if (this.rewardedCallbacks.onAdFailedToShow) {
        this.rewardedCallbacks.onAdFailedToShow(error);
      }
      // Try to load a new ad after error
      setTimeout(() => this.loadRewardedAd(), 1000);
    });

    this.rewardedAd.addAdEventListener(AdEventType.OPENED, () => {
      console.log('[AdMob] Rewarded ad opened successfully');
      this.isShowingRewardedAd = true;
    });

    this.rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('[AdMob] Rewarded ad closed');
      this.isShowingRewardedAd = false;
      this.rewardedAd = null;
      this.rewardedLoadTime = 0;
      // Call the onAdClosed callback
      if (this.rewardedCallbacks.onAdClosed) {
        this.rewardedCallbacks.onAdClosed();
      }
      // Clear callbacks
      this.rewardedCallbacks = {};
      // Pre-load next rewarded ad
      this.loadRewardedAd().catch(console.error);
    });

    this.rewardedAd.addAdEventListener(AdEventType.CLICKED, () => {
      console.log('[AdMob] Rewarded ad clicked');
    });
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current ad status for debugging
   */
  public getAdStatus(): {
    isLoadingAd: boolean;
    isShowingAd: boolean;
      isAdAvailable: boolean;
      loadTime: number;
      timeSinceLoad: number;
      isLoadingRewardedAd: boolean;
      isShowingRewardedAd: boolean;
      isRewardedAdAvailable: boolean;
      rewardedLoadTime: number;
      timeSinceRewardedLoad: number;
    } {
      return {
        isLoadingAd: this.isLoadingAd,
        isShowingAd: this.isShowingAd,
        isAdAvailable: this.isAdAvailable(),
        loadTime: this.loadTime,
        timeSinceLoad: this.loadTime > 0 ? Date.now() - this.loadTime : 0,
        isLoadingRewardedAd: this.isLoadingRewardedAd,
        isShowingRewardedAd: this.isShowingRewardedAd,
        isRewardedAdAvailable: this.isRewardedAdAvailable(),
        rewardedLoadTime: this.rewardedLoadTime,
        timeSinceRewardedLoad: this.rewardedLoadTime > 0 ? Date.now() - this.rewardedLoadTime : 0,
      };
    }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.appOpenAd) {
      this.appOpenAd = null;
    }
    if (this.rewardedAd) {
      this.rewardedAd = null;
    }
    this.loadTime = 0;
    this.rewardedLoadTime = 0;
    this.isLoadingAd = false;
    this.isShowingAd = false;
    this.isLoadingRewardedAd = false;
    this.isShowingRewardedAd = false;
    this.rewardedCallbacks = {};
  }
}

// Export singleton instance
export const adMobService = AdMobService.getInstance();
