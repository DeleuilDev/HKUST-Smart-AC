import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { Design } from '@/constants/Design';

export default function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Design.colors.surface,
    borderRadius: Design.radii.large,
    padding: Design.spacing.lg,
    ...Design.shadow.card,
  },
});

