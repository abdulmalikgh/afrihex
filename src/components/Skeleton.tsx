import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors } from '../constants/colors';
import { radius } from '../constants/radius';
import { spacing } from '../constants/spacing';

/**
 * Shimmering placeholder block. Preferred over a bare spinner because it
 * preserves the shape of the content that is about to arrive, which keeps
 * the layout stable and makes waits feel shorter.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  style?: object;
}) {
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.85, { duration: 850 }), -1, true);
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return <Animated.View style={[styles.block, { width, height }, animatedStyle, style]} />;
}

/** Skeleton shaped like a list of result cards. */
export function SkeletonCardList({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, position) => (
        <View key={position} style={styles.card}>
          <Skeleton width="55%" height={15} />
          <Skeleton width="35%" height={12} />
          <Skeleton width="45%" height={11} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: radius.sm,
    backgroundColor: colors.borderStrong,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.md,
  },
});
