export const Design = {
  colors: {
    primary: '#6C5CE7',
    secondary: '#A29BFE',
    background: '#FFFFFF',
    surface: '#F9F9FB',
    textPrimary: '#111111',
    textSecondary: '#666666',
    accent: '#8E7CFF',
    statusPositive: '#4CAF50',
    statusNegative: '#E53935',
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
      shadowColor: 'rgba(0,0,0,0.1)',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 1,
      shadowRadius: 24,
      elevation: 8,
    },
    floating: {
      shadowColor: 'rgba(0,0,0,0.12)',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 1,
      shadowRadius: 40,
      elevation: 10,
    },
  },
} as const;

export type DesignTokens = typeof Design;

