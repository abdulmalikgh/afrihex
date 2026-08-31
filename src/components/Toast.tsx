import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';

import { colors } from '../constants/colors';
import { radius } from '../constants/radius';
import { spacing } from '../constants/spacing';
import { AppText } from './AppText';

type ToastProps = {
  message: string | null;
  /** Distance from the bottom of the screen, so it clears the tab bar. */
  bottomOffset?: number;
};

/**
 * Floating confirmation that overlays content instead of occupying layout space,
 * so showing it never pushes the surrounding UI around.
 */
export function Toast({ message, bottomOffset = spacing['3xl'] }: ToastProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    const visible = Boolean(message);

    opacity.value = withTiming(visible ? 1 : 0, { duration: visible ? 160 : 220 });
    translateY.value = withTiming(visible ? 0 : 12, { duration: visible ? 160 : 220 });
  }, [message, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!message) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { bottom: bottomOffset }, animatedStyle]}
    >
      <Check color={colors.primaryLight} size={16} />
      <AppText variant="caption">{message}</AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    left: 0,
    right: 0,
    marginHorizontal: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    maxWidth: 260,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 12,
    zIndex: 40,
  },
});
