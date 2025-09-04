import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function IconButton({
  name,
  onPress,
  color = '#FFFFFF',
  size = 22,
  style,
  background = 'rgba(255,255,255,0.2)',
}: {
  name: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
  color?: string;
  size?: number;
  style?: ViewStyle;
  background?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.base, { backgroundColor: background }, pressed && { opacity: 0.85 }, style]}
      accessibilityRole="button"
    >
      <MaterialCommunityIcons name={name} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

