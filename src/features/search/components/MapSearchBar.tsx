import { Pressable, StyleSheet, View } from 'react-native';
import { Search, UserRound, X } from 'lucide-react-native';

import { AppText } from '../../../components';
import { mapColors, mapElevation, mapPressedLayer, mapShape, mapSize } from '../../../constants/material';
import { spacing } from '../../../constants/spacing';

type MapSearchBarProps = {
  /** Current query, shown in place of the placeholder once something is resolved. */
  value: string;
  placeholder: string;
  onPress: () => void;
  onClear: () => void;
  onAccountPress: () => void;
};

/**
 * The resting state of the search field: a floating pill over the map that is a
 * button, not an input. Tapping it hands off to the full-screen search panel,
 * which is where the keyboard, recents and suggestions live — the same split
 * Google Maps uses so the map is never squeezed by a half-open keyboard.
 */
export function MapSearchBar({ value, placeholder, onPress, onClear, onAccountPress }: MapSearchBarProps) {
  const hasValue = value.trim().length > 0;

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="search"
        accessibilityLabel={hasValue ? `Search. Current query ${value}` : placeholder}
        onPress={onPress}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}
      >
        <Search color={mapColors.onSurfaceVariant} size={20} />
        <AppText variant="body" numberOfLines={1} style={[styles.value, !hasValue && styles.placeholder]}>
          {hasValue ? value : placeholder}
        </AppText>
      </Pressable>

      {hasValue ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={onClear}
          hitSlop={6}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <X color={mapColors.onSurfaceVariant} size={20} />
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open your account"
        onPress={onAccountPress}
        hitSlop={6}
        style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}
      >
        <UserRound color={mapColors.onSurfaceVariant} size={18} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: mapSize.searchBar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: mapShape.full,
    backgroundColor: mapColors.surface,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    ...mapElevation.level3,
  },
  field: {
    flex: 1,
    minWidth: 0,
    minHeight: mapSize.searchBar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  value: {
    flex: 1,
    minWidth: 0,
    color: mapColors.onSurface,
  },
  placeholder: {
    color: mapColors.onSurfaceVariant,
  },
  pressed: {
    opacity: 0.7,
  },
  iconButton: {
    width: mapSize.iconButton,
    height: mapSize.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: mapShape.full,
  },
  avatar: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: mapShape.full,
    backgroundColor: mapColors.surfaceContainerHigh,
    marginRight: spacing.xs,
  },
  avatarPressed: {
    backgroundColor: mapPressedLayer,
  },
});
