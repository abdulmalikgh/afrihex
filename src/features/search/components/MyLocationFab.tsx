import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Animated, { clamp, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { LocateFixed, LocateOff } from 'lucide-react-native';

import { mapColors, mapElevation, mapShape, mapSize } from '../../../constants/material';
import { spacing } from '../../../constants/spacing';

type MyLocationFabProps = {
  onPress: () => void;
  isLocating: boolean;
  /** Permission is denied and cannot be re-asked; the button opens Settings instead. */
  isBlocked: boolean;
  /** Live height of the bottom sheet, so the button rides its top edge. */
  sheetVisibleHeight: SharedValue<number>;
  /** Gap kept between the button and the sheet's top edge. */
  gap?: number;
  /**
   * Ceiling on how far the button rises. Without it a fully dragged sheet would
   * push it up into the search bar instead of leaving it over the map.
   */
  maxRise: number;
};

/**
 * Persistent my-location button. Anchored to the map rather than the sheet, and
 * translated by the sheet's live height so it stays visible and reachable at
 * every snap point instead of disappearing behind an expanded sheet.
 */
export function MyLocationFab({
  onPress,
  isLocating,
  isBlocked,
  sheetVisibleHeight,
  gap = spacing.md,
  maxRise,
}: MyLocationFabProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -clamp(sheetVisibleHeight.value + gap, gap, maxRise) }],
  }));

  const Icon = isBlocked ? LocateOff : LocateFixed;
  const iconColor = isBlocked ? mapColors.error : mapColors.primary;

  return (
    <Animated.View style={[styles.anchor, animatedStyle]} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isBlocked ? 'Location is blocked. Open settings' : 'Show my location'}
        accessibilityState={{ busy: isLocating, disabled: isLocating }}
        disabled={isLocating}
        onPress={onPress}
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      >
        {isLocating ? <ActivityIndicator size="small" color={mapColors.primary} /> : <Icon color={iconColor} size={24} />}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 0,
    zIndex: 8,
  },
  fab: {
    width: mapSize.fab,
    height: mapSize.fab,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: mapShape.large,
    backgroundColor: mapColors.surface,
    ...mapElevation.level3,
  },
  pressed: {
    backgroundColor: mapColors.surfaceContainerHigh,
  },
});
