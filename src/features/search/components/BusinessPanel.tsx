import { Fragment, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { LandmarkMatch } from '../../../api/search';
import { mapColors } from '../../../constants/material';
import { spacing } from '../../../constants/spacing';
import { formatDistance, formatKind, getKindIcon } from '../../../utils/landmarkKinds';
import { hapticSelection } from '../../../utils/haptics';
import { MapChip } from './MapActions';
import { MapDivider, MapListRow } from './MapListRow';
import { MapEmptyState, MapErrorState, MapLoadingState } from './MapStates';

type BusinessPanelProps = {
  selectedKind: string | null;
  onSelectKind: (kind: string) => void;
  isCountsLoading: boolean;
  countsError: string | null;
  kinds: Array<{ kind: string; count: number }>;
  isListLoading: boolean;
  listError: string | null;
  landmarks: LandmarkMatch[];
  onRetryCounts: () => void;
  onRetryList: () => void;
};

export function BusinessPanel({
  selectedKind,
  onSelectKind,
  isCountsLoading,
  countsError,
  kinds,
  isListLoading,
  listError,
  landmarks,
  onRetryCounts,
  onRetryList,
}: BusinessPanelProps) {
  const sortedLandmarks = useMemo(
    () => [...landmarks].sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity)),
    [landmarks],
  );

  if (isCountsLoading) {
    return <MapLoadingState label="Loading business categories" />;
  }

  if (countsError) {
    return (
      <View style={styles.inset}>
        <MapErrorState message={countsError} onRetry={onRetryCounts} />
      </View>
    );
  }

  if (kinds.length === 0) {
    return <MapEmptyState title="No businesses found" description="No grouped places were returned nearby." />;
  }

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
        accessibilityLabel="Business categories"
      >
        {kinds.map((item) => (
          <MapChip
            key={item.kind}
            label={`${formatKind(item.kind)} · ${item.count}`}
            icon={getKindIcon(item.kind)}
            elevated={false}
            selected={selectedKind === item.kind}
            onPress={() => {
              hapticSelection();
              onSelectKind(item.kind);
            }}
          />
        ))}
      </ScrollView>

      {!selectedKind ? (
        <MapEmptyState title="Pick a category" description="Choose a business type to list places around this address." />
      ) : null}

      {selectedKind && isListLoading ? <MapLoadingState label={`Loading ${formatKind(selectedKind)}`} /> : null}

      {selectedKind && listError ? (
        <View style={styles.inset}>
          <MapErrorState message={listError} onRetry={onRetryList} />
        </View>
      ) : null}

      {selectedKind && !isListLoading && !listError && sortedLandmarks.length === 0 ? (
        <MapEmptyState title="No places in this category" />
      ) : null}

      {sortedLandmarks.map((landmark, index) => {
        const KindIcon = getKindIcon(landmark.kind);
        const distanceLabel = formatDistance(landmark.distance_m);

        return (
          <Fragment key={landmark.slug}>
            {index > 0 ? <MapDivider /> : null}
            <MapListRow
              iconVariant="container"
              icon={<KindIcon color={mapColors.onSurfaceVariant} size={20} />}
              title={landmark.name}
              subtitle={[formatKind(landmark.kind), landmark.street].filter(Boolean).join(' · ')}
              meta={distanceLabel ?? undefined}
            />
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chipScroll: {
    flexGrow: 0,
  },
  chipRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inset: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
