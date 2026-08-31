import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import { Clock } from 'lucide-react-native';

import { mapColors } from '../../../constants/material';
import { spacing } from '../../../constants/spacing';
import type { RecentSearch } from '../../../api/search';
import { MapDivider, MapListRow } from './MapListRow';
import { MapEmptyState, MapLoadingState } from './MapStates';
import type { ResolvedFindGpsResult } from '../hooks/useFindGpsSearch';

export type LocalRecentLookup = {
  key: string;
  query: string;
  result: ResolvedFindGpsResult;
};

type RecentLookupsProps = {
  recentSearches: RecentSearch[];
  localRecentLookups: LocalRecentLookup[];
  showServerRecent: boolean;
  isLoading: boolean;
  onRecentPress: (recentSearch: RecentSearch) => void;
  onLocalRecentPress: (recentLookup: LocalRecentLookup) => void;
};

type RecentRow = {
  key: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
};

/**
 * Recent searches, shown inside the search panel the way Google Maps does it:
 * plain rows behind a clock icon, newest first, server history and this
 * session's local lookups merged into one list so signed-out users still get
 * somewhere to tap.
 */
export function RecentLookups({
  recentSearches,
  localRecentLookups,
  showServerRecent,
  isLoading,
  onRecentPress,
  onLocalRecentPress,
}: RecentLookupsProps) {
  const rows = buildRows({
    recentSearches,
    localRecentLookups,
    showServerRecent,
    onRecentPress,
    onLocalRecentPress,
  });

  if (isLoading && rows.length === 0) {
    return <MapLoadingState label="Loading recent searches" />;
  }

  if (rows.length === 0) {
    return (
      <MapEmptyState
        title="No recent searches"
        description="Search a place name, a landmark, or a Ghana GPS code to get started."
      />
    );
  }

  return (
    <View style={styles.list}>
      {rows.map((row, index) => (
        <Fragment key={row.key}>
          {index > 0 ? <MapDivider /> : null}
          <MapListRow
            icon={<Clock color={mapColors.onSurfaceVariant} size={20} />}
            title={row.title}
            subtitle={row.subtitle}
            onPress={row.onPress}
          />
        </Fragment>
      ))}
    </View>
  );
}

function buildRows({
  recentSearches,
  localRecentLookups,
  showServerRecent,
  onRecentPress,
  onLocalRecentPress,
}: Omit<RecentLookupsProps, 'isLoading'>): RecentRow[] {
  const rows: RecentRow[] = [];
  const seen = new Set<string>();

  if (showServerRecent) {
    for (const recentSearch of recentSearches) {
      const dedupeKey = recentSearch.query.trim().toLowerCase();

      if (seen.has(dedupeKey)) {
        continue;
      }

      seen.add(dedupeKey);
      rows.push({
        key: `server-${recentSearch.id}`,
        title: recentSearch.query,
        subtitle: recentSearch.display_name ?? recentSearch.result_ref,
        onPress: () => onRecentPress(recentSearch),
      });
    }
  }

  for (const recentLookup of localRecentLookups) {
    const dedupeKey = recentLookup.query.trim().toLowerCase();

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    rows.push({
      key: `local-${recentLookup.key}`,
      title: recentLookup.query,
      subtitle: recentLookup.result.displayName,
      onPress: () => onLocalRecentPress(recentLookup),
    });
  }

  return rows;
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: spacing.xs,
  },
});
