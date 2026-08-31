import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { AppText } from '../../../components';
import { mapColors, mapElevation, mapPressedLayer, mapShape, mapSize } from '../../../constants/material';
import { spacing } from '../../../constants/spacing';

type MapActionCircleProps = {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  /** `filled` is the single primary action in a row; everything else is `tonal`. */
  variant?: 'filled' | 'tonal';
  disabled?: boolean;
  busy?: boolean;
};

/**
 * Circular icon button with a caption beneath it — the shape Google Maps uses for
 * its Directions / Nearby rows. One filled button per row carries the primary
 * action so the row still has a clear entry point.
 */
export function MapActionCircle({
  label,
  icon: Icon,
  onPress,
  variant = 'tonal',
  disabled = false,
  busy = false,
}: MapActionCircleProps) {
  const filled = variant === 'filled';
  const iconColor = filled ? mapColors.onPrimary : mapColors.onSurfaceVariant;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={styles.action}
    >
      {({ pressed }) => (
        <>
          <View
            style={[
              styles.circle,
              filled ? styles.circleFilled : styles.circleTonal,
              disabled && styles.disabled,
              pressed && styles.circlePressed,
            ]}
          >
            {busy ? <ActivityIndicator size="small" color={iconColor} /> : <Icon color={iconColor} size={22} />}
          </View>
          <AppText variant="caption" align="center" numberOfLines={2} style={styles.actionLabel}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

type MapChipProps = {
  label: string;
  icon?: LucideIcon;
  selected?: boolean;
  onPress: () => void;
  /** Floating chips cast a shadow; chips inside the sheet are outlined instead. */
  elevated?: boolean;
};

/** MD3 filter chip, floating over the map or sitting inside the sheet. */
export function MapChip({ label, icon: Icon, selected = false, onPress, elevated = true }: MapChipProps) {
  const contentColor = selected ? mapColors.onSecondaryContainer : mapColors.onSurfaceVariant;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        elevated ? styles.chipElevated : styles.chipOutlined,
        selected ? styles.chipSelected : styles.chipUnselected,
        pressed && styles.chipPressed,
      ]}
    >
      {Icon ? <Icon color={contentColor} size={16} /> : null}
      <AppText variant="caption" numberOfLines={1} style={{ color: contentColor }}>
        {label}
      </AppText>
    </Pressable>
  );
}

type MapTabsProps<T extends string> = {
  options: ReadonlyArray<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
};

/** MD3 secondary tabs: full-width labels with an indicator under the active one. */
export function MapTabs<T extends string>({ options, value, onChange, accessibilityLabel }: MapTabsProps<T>) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.tab, pressed && styles.chipPressed]}
          >
            <AppText
              variant={selected ? 'bodyStrong' : 'body'}
              style={selected ? styles.tabLabelSelected : styles.tabLabel}
            >
              {option.label}
            </AppText>
            <View style={[styles.tabIndicator, selected && styles.tabIndicatorSelected]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    // Shares the row evenly rather than claiming a fixed width, so four actions
    // span the sheet on a large phone and still fit on a small one.
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: spacing.sm,
  },
  circle: {
    width: mapSize.fab,
    height: mapSize.fab,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: mapShape.full,
  },
  circleFilled: {
    backgroundColor: mapColors.primary,
  },
  circleTonal: {
    backgroundColor: mapColors.surfaceContainerHigh,
  },
  circlePressed: {
    opacity: 0.86,
  },
  disabled: {
    opacity: 0.38,
  },
  actionLabel: {
    color: mapColors.onSurfaceVariant,
  },
  chip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: mapShape.small,
    paddingHorizontal: spacing.md,
  },
  chipElevated: {
    ...mapElevation.level2,
  },
  chipOutlined: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mapColors.outline,
  },
  chipUnselected: {
    backgroundColor: mapColors.surface,
  },
  chipSelected: {
    backgroundColor: mapColors.secondaryContainer,
  },
  chipPressed: {
    backgroundColor: mapPressedLayer,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mapColors.outlineVariant,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  tabLabel: {
    color: mapColors.onSurfaceVariant,
  },
  tabLabelSelected: {
    color: mapColors.primary,
  },
  tabIndicator: {
    height: 3,
    alignSelf: 'stretch',
    marginHorizontal: spacing.lg,
    borderTopLeftRadius: mapShape.full,
    borderTopRightRadius: mapShape.full,
    backgroundColor: 'transparent',
  },
  tabIndicatorSelected: {
    backgroundColor: mapColors.primary,
  },
});
