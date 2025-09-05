import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { Design } from '@/constants/Design';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Variant = 'success' | 'error' | 'info';

export default function Toast({
  visible,
  message,
  title,
  variant = 'info',
  onHide,
  autoHideMs = 2200,
}: {
  visible: boolean;
  message: string;
  title?: string;
  variant?: Variant;
  onHide?: () => void;
  autoHideMs?: number;
}) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
      ]).start();
      if (autoHideMs && autoHideMs > 0) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          hide();
        }, autoHideMs);
      }
    } else {
      hide(true);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const hide = (silent?: boolean) => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -10, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      if (!silent && onHide) onHide();
    });
  };

  const colors = {
    success: { icon: Design.colors.statusPositive, bg: '#FFFFFF', border: '#E6F4EA' },
    error: { icon: Design.colors.statusNegative, bg: '#FFFFFF', border: '#FDECEC' },
    info: { icon: Design.colors.primary, bg: '#FFFFFF', border: '#ECECEC' },
  }[variant];

  const iconName = variant === 'success' ? 'check-circle' : variant === 'error' ? 'alert-circle' : 'information';

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={{
        position: 'absolute',
        top: Math.max(12, insets.top + 12),
        left: 16,
        right: 16,
        alignItems: 'center',
        zIndex: 50,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <Pressable onPress={() => hide()} style={[styles.base, { backgroundColor: colors.bg, borderColor: colors.border }]}>
        <MaterialCommunityIcons name={iconName} size={20} color={colors.icon} style={{ marginRight: 8 }} />
        <View style={{ flex: 1 }}>
          {title ? <ThemedText style={styles.title}>{title}</ThemedText> : null}
          <ThemedText style={styles.msg}>{message}</ThemedText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    maxWidth: 560,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Design.spacing.md,
    paddingVertical: 12,
    borderRadius: Design.radii.large,
    borderWidth: 1,
    ...Design.shadow.card,
  },
  title: { fontSize: 14, fontWeight: '700', color: Design.colors.textPrimary },
  msg: { fontSize: 14, color: Design.colors.textPrimary },
});
