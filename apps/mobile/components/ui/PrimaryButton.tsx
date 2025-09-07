import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { Design } from '@/constants/Design';

type Variant = 'primary' | 'neutral' | 'danger';

type Appearance = 'soft' | 'solid';
type Size = 'sm' | 'md';

export default function PrimaryButton({
  title,
  onPress,
  variant = 'primary',
  appearance = 'soft',
  size = 'md',
  iconLeft,
  style,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  appearance?: Appearance;
  size?: Size;
  iconLeft?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  style?: ViewStyle;
  disabled?: boolean;
}) {
  let bg = Design.colors.surfaceElevated;
  let color = Design.colors.textPrimary;

  if (appearance === 'soft') {
    if (variant === 'primary') {
      bg = Design.colors.accentTintBg;
      color = Design.colors.primary;
    } else if (variant === 'danger') {
      bg = Design.colors.statusNegativeBg;
      color = Design.colors.statusNegative;
    } else {
      bg = Design.colors.surfaceElevated;
      color = Design.colors.textPrimary;
    }
  } else if (appearance === 'solid') {
    bg = variant === 'primary' ? Design.colors.primary : variant === 'danger' ? Design.colors.statusNegative : Design.colors.textPrimary;
    color = '#FFFFFF';
  }

  const dims = size === 'sm' ? styles.sizeSm : styles.sizeMd;

  const opacity = disabled ? 0.5 : 1;
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.base, dims, { backgroundColor: bg, opacity }, pressed && { transform: [{ scale: 0.98 }] }, style]}>
      <View style={styles.contentRow}>
        {iconLeft ? <MaterialCommunityIcons name={iconLeft} size={18} color={color} style={{ marginRight: 8 }} /> : null}
        <ThemedText type="link" style={{ color }}>{title}</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Design.radii.pill,
    paddingHorizontal: Design.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Design.shadow.floating,
  },
  sizeMd: {
    minHeight: 48,
    paddingVertical: Design.spacing.md,
  },
  sizeSm: {
    minHeight: 44,
    paddingVertical: 10,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
