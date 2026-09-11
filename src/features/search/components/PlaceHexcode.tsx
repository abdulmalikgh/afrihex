import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { getHexcodeForPoint } from '../../../api/search';
import { AppText } from '../../../components';
import { mapColors } from '../../../constants/material';
import { spacing } from '../../../constants/spacing';
import { HexcodeLandmarks } from '../../certificates/components/HexcodeLandmarks';

/**
 * The hex code for a resolved place, and what sits in that cell.
 *
 * Fetched here rather than folded into the search chain: search, lookup and
 * reverse do not return a hex, and adding a second round trip to every search
 * to carry one would be paying for it on every result instead of the few a user
 * actually opens. This runs when the details section is expanded.
 */
export function PlaceHexcode({ lat, lng }: { lat: number; lng: number }) {
  const query = useQuery({
    // Rounded to ~1 m so panning back to the same place reuses the answer.
    queryKey: ['hexcode', 'point', lat.toFixed(5), lng.toFixed(5)],
    queryFn: () => getHexcodeForPoint({ lat, lng }),
    staleTime: 3_600_000,
    retry: false,
  });

  if (!query.data) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <AppText variant="caption" style={styles.label}>
          Hex address
        </AppText>
        <AppText variant="caption" numberOfLines={1} selectable style={styles.value}>
          {query.data.code}
        </AppText>
      </View>

      <HexcodeLandmarks hexCode={query.data.code} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: {
    width: 96,
    color: mapColors.onSurfaceVariant,
  },
  value: {
    flex: 1,
    minWidth: 0,
    color: mapColors.onSurface,
  },
});
