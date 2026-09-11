import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppText } from '../../../components';
import { colors } from '../../../constants/colors';
import { spacing } from '../../../constants/spacing';
import { getHexcodeLandmarks } from '../../../api/search';
import { formatDistance, formatKind, getKindIcon } from '../../../utils/landmarkKinds';

/** Enough to tell someone where they are; more turns a detail row into a directory. */
const MAX_LANDMARKS = 5;

/**
 * What sits at the verified address, keyed off the hex code the check returned.
 *
 * Renders nothing at all when the lookup is empty or fails. The endpoint's
 * response shape is undocumented and this is context on a screen that already
 * did its job — a broken or missing section here must never look like the
 * verification itself went wrong.
 */
export function HexcodeLandmarks({ hexCode }: { hexCode: string }) {
  const query = useQuery({
    queryKey: ['hexcode', 'landmarks', hexCode],
    queryFn: () => getHexcodeLandmarks(hexCode),
    // Hex cells are fixed ground: what is inside one does not change between two
    // checks of the same address.
    staleTime: 3_600_000,
    retry: false,
  });

  /**
   * `inside` first: a landmark whose footprint contains this cell is a better
   * answer to "what is here" than one 40 m away, and only `nearby` entries
   * carry a distance to show.
   */
  const landmarks = [...(query.data?.inside ?? []), ...(query.data?.nearby ?? [])].slice(
    0,
    MAX_LANDMARKS,
  );

  if (landmarks.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <AppText variant="caption" tone="muted">
        What&apos;s here
      </AppText>

      {landmarks.map((landmark) => {
        const Icon = getKindIcon(landmark.kind);

        return (
          <View key={landmark.slug} style={styles.row}>
            <Icon color={colors.muted} size={16} />
            <AppText variant="caption" numberOfLines={1} style={styles.name}>
              {landmark.name}
            </AppText>
            <AppText variant="caption" tone="faint">
              {landmark.containment === 'inside'
                ? formatKind(landmark.kind)
                : (formatDistance(landmark.distance_m) ?? formatKind(landmark.kind))}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 28,
  },
  name: {
    flex: 1,
    minWidth: 0,
  },
});
