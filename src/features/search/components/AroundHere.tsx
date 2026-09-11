import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronDown, ChevronUp, Store } from 'lucide-react-native';

import { AppText } from '../../../components';
import { mapColors, mapShape } from '../../../constants/material';
import { spacing } from '../../../constants/spacing';
import { formatKind } from '../../../utils/landmarkKinds';
import { hapticLight } from '../../../utils/haptics';
import { BusinessPanel } from './BusinessPanel';
import { MapDivider } from './MapListRow';

type AroundHereProps = {
  /** Everything `BusinessPanel` needs, passed straight through when expanded. */
  businessProps: Parameters<typeof BusinessPanel>[0];
};

/** Enough to show what kind of area this is without becoming a list of its own. */
const PREVIEW_KINDS = 3;

/**
 * What is around the place the user just found.
 *
 * Collapsed by default, and not a tab. Someone who searched for a place came
 * for the place — its code, and a way to get there. Google and Apple both keep
 * the place card whole and treat "what else is here" as a separate gesture, so
 * this sits below the card as one line the user can open, rather than a tab bar
 * competing with the code for the top of the sheet.
 */
export function AroundHere({ businessProps }: AroundHereProps) {
  const [isOpen, setIsOpen] = useState(false);

  const total = businessProps.kinds.reduce((sum, entry) => sum + entry.count, 0);
  const preview = businessProps.kinds.slice(0, PREVIEW_KINDS);

  // Nothing to offer yet — no header, no empty state, no row taking up space.
  if (!businessProps.isCountsLoading && businessProps.kinds.length === 0) {
    return null;
  }

  return (
    <View>
      <MapDivider inset={false} />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={
          total > 0 ? `Around here, ${total} places. Tap to ${isOpen ? 'collapse' : 'expand'}` : 'Around here'
        }
        onPress={() => {
          setIsOpen((open) => !open);
          hapticLight();
        }}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <Store color={mapColors.onSurfaceVariant} size={20} />

        <View style={styles.headerText}>
          <AppText variant="bodyStrong" style={styles.title}>
            Around here
          </AppText>

          {/* The preview is the point of the collapsed state: it tells you
              whether opening it is worth a tap. */}
          {preview.length > 0 ? (
            <AppText variant="caption" numberOfLines={1} style={styles.subtitle}>
              {preview.map((entry) => `${formatKind(entry.kind)} ${entry.count}`).join(' · ')}
            </AppText>
          ) : (
            <AppText variant="caption" numberOfLines={1} style={styles.subtitle}>
              Looking around…
            </AppText>
          )}
        </View>

        {isOpen ? (
          <ChevronUp color={mapColors.primary} size={18} />
        ) : (
          <ChevronDown color={mapColors.primary} size={18} />
        )}
      </Pressable>

      {isOpen ? <BusinessPanel {...businessProps} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    borderRadius: mapShape.medium,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerText: {
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
  pressed: {
    backgroundColor: mapColors.surfaceContainerHigh,
  },
});
