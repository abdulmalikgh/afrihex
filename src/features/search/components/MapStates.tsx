import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { RefreshCcw, TriangleAlert } from 'lucide-react-native';

import { AppText } from '../../../components';
import { mapColors, mapPressedLayer, mapShape } from '../../../constants/material';
import { spacing } from '../../../constants/spacing';

/**
 * Loading, error and empty states rendered on the light map surface. The shared
 * components in `src/components` are painted for the dark AfriHex palette and
 * would be unreadable here, so the map keeps its own light set.
 */

export function MapLoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={styles.block} accessibilityRole="progressbar">
      <ActivityIndicator color={mapColors.primary} />
      <AppText variant="caption" style={styles.mutedText}>
        {label}
      </AppText>
    </View>
  );
}

export function MapErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorBanner} accessibilityRole="alert">
      <TriangleAlert color={mapColors.error} size={18} />
      <AppText variant="caption" style={styles.errorText}>
        {message}
      </AppText>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry"
          onPress={onRetry}
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        >
          <RefreshCcw color={mapColors.onErrorContainer} size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function MapEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.block}>
      <AppText variant="bodyStrong" align="center" style={styles.title}>
        {title}
      </AppText>
      {description ? (
        <AppText variant="caption" align="center" style={styles.mutedText}>
          {description}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
        >
          <AppText variant="caption" style={styles.textButtonLabel}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  title: {
    color: mapColors.onSurface,
  },
  mutedText: {
    color: mapColors.onSurfaceVariant,
    maxWidth: 320,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: mapShape.medium,
    backgroundColor: mapColors.errorContainer,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  errorText: {
    flex: 1,
    color: mapColors.onErrorContainer,
  },
  retry: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: mapShape.full,
  },
  pressed: {
    backgroundColor: mapPressedLayer,
  },
  textButton: {
    minHeight: 40,
    justifyContent: 'center',
    marginTop: spacing.xs,
    borderRadius: mapShape.full,
    paddingHorizontal: spacing.lg,
  },
  textButtonLabel: {
    color: mapColors.primary,
  },
});
