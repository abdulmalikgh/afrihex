import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../../../components';
import { mapColors, mapPressedLayer, mapShape, mapSize } from '../../../constants/material';
import { spacing } from '../../../constants/spacing';

type MapListRowProps = {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  /** Trailing text such as a distance. Kept short; it never wraps. */
  meta?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** `container` draws the Google-style grey disc behind the icon. */
  iconVariant?: 'plain' | 'container';
};

/**
 * One row of a Material list on a light map surface: leading icon, two lines of
 * text, optional trailing meta. Matches the 56dp one-line / 72dp two-line MD3
 * list metrics so recents, suggestions and results all share a rhythm.
 */
export function MapListRow({
  icon,
  title,
  subtitle,
  meta,
  trailing,
  onPress,
  accessibilityLabel,
  iconVariant = 'plain',
}: MapListRowProps) {
  const content = (
    <>
      <View style={[styles.icon, iconVariant === 'container' && styles.iconContainer]}>{icon}</View>
      <View style={styles.text}>
        <AppText variant="body" numberOfLines={1} style={styles.title}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {meta ? (
        <AppText variant="caption" numberOfLines={1} style={styles.meta}>
          {meta}
        </AppText>
      ) : null}
      {trailing}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

/** Hairline between list rows, inset to the row's text so icons stay in their own column. */
export function MapDivider({ inset = true }: { inset?: boolean }) {
  return <View style={[styles.divider, inset && styles.dividerInset]} />;
}

/** Section title inside the sheet, e.g. "Nearby places". */
export function MapSectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="bodyStrong" style={styles.sectionTitle}>
        {title}
      </AppText>
      {action}
    </View>
  );
}

/** Grouped surface that holds a run of rows, as Google groups recents into one card. */
export function MapCard({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    minHeight: mapSize.listRow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: {
    backgroundColor: mapPressedLayer,
  },
  icon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: mapSize.iconButton,
    height: mapSize.iconButton,
    borderRadius: mapShape.full,
    backgroundColor: mapColors.surfaceContainerHigh,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    color: mapColors.onSurface,
  },
  subtitle: {
    color: mapColors.onSurfaceVariant,
  },
  meta: {
    color: mapColors.onSurfaceVariant,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: mapColors.outlineVariant,
  },
  dividerInset: {
    marginLeft: mapSize.rowTextInset,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    color: mapColors.onSurface,
  },
  card: {
    overflow: 'hidden',
    borderRadius: mapShape.medium,
    backgroundColor: mapColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mapColors.outlineVariant,
  },
});
