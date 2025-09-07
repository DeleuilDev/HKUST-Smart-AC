import { Appearance } from 'react-native';

type Palette = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  muted: string;
  mutedSurface: string;
  accentTintBg: string;
  statusPositive: string;
  statusNegative: string;
  statusPositiveBg: string;
  statusNegativeBg: string;
  statusWarning: string;
  statusWarningBg: string;
};

const light: Palette = {
  primary: '#6C5CE7',
  secondary: '#A29BFE',
  accent: '#8E7CFF',
  background: '#FFFFFF',
  surface: '#F9F9FB',
  surfaceElevated: '#FFFFFF',
  textPrimary: '#111111',
  textSecondary: '#666666',
  border: '#ECECEC',
  muted: '#F1F1F4',
  mutedSurface: '#F7F7FA',
  // soft violet-tint backgrounds used for chips/pills/indicators
  accentTintBg: '#EBE9FF',
  statusPositive: '#4CAF50',
  statusNegative: '#E53935',
  statusPositiveBg: '#E8F5E9',
  statusNegativeBg: '#FFEBEE',
  statusWarning: '#E65100',
  statusWarningBg: '#FFF8E1',
};

const dark: Palette = {
  primary: '#6C5CE7',
  secondary: '#A29BFE',
  accent: '#8E7CFF',
  background: '#0F0F14',
  surface: '#16161D',
  surfaceElevated: '#1B1B24',
  textPrimary: '#ECEDEE',
  textSecondary: '#A3A3B2',
  border: '#2A2A35',
  muted: '#1E1E27',
  mutedSurface: '#191926',
  // darker violet-tinted background for dark mode
  accentTintBg: '#2B2655',
  statusPositive: '#4CAF50',
  statusNegative: '#E53935',
  statusPositiveBg: '#1B3B1F',
  statusNegativeBg: '#3B1B1B',
  statusWarning: '#EF6C00',
  statusWarningBg: '#3B2F1B',
};

function currentPalette(): Palette {
  const cs = Appearance.getColorScheme();
  return cs === 'dark' ? dark : light;
}

export const Design = {
  // Use getters so reads reflect the current color scheme
  get colors() {
    return currentPalette();
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radii: {
    small: 8,
    medium: 16,
    large: 24,
    xl: 32,
    pill: 100,
  },
  typography: {
    sizes: {
      caption: 12,
      body: 14,
      bodyLarge: 16,
      subtitle: 18,
      title: 22,
      headline: 28,
    },
    weights: {
      light: '300' as const,
      regular: '400' as const,
      medium: '500' as const,
      bold: '700' as const,
    },
  },
  shadow: {
    card: {
      shadowColor: 'rgba(0,0,0,0.25)',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.8,
      shadowRadius: 20,
      elevation: 8,
    },
    floating: {
      shadowColor: 'rgba(0,0,0,0.3)',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.9,
      shadowRadius: 30,
      elevation: 10,
    },
  },
} as const;

export type DesignTokens = typeof Design;
