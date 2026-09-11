import { StyleSheet, View } from 'react-native';

import { mapColors, mapElevation, mapShape } from '../../../constants/material';
import { spacing } from '../../../constants/spacing';
import type { AutocompleteResult, RecentSearch } from '../../../api/search';
import { MapSearchBar } from './MapSearchBar';
import { MapErrorState } from './MapStates';
import { SearchPanel } from './SearchPanel';
import type { LocalRecentLookup } from './RecentLookups';

type SearchOverlayProps = {
  topInset: number;
  /** When open the panel takes the whole screen; when closed only the pill floats. */
  isPanelOpen: boolean;
  onOpenPanel: () => void;
  onClosePanel: () => void;
  query: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  onClearQuery: () => void;
  onSubmit: (query: string) => void;
  onAccountPress: () => void;
  onVoicePress: () => void;
  suggestions: AutocompleteResult[];
  isSuggestionsLoading: boolean;
  suggestionsError: string | null;
  onSuggestionPress: (suggestion: AutocompleteResult) => void;
  recentSearches: RecentSearch[];
  localRecentLookups: LocalRecentLookup[];
  showServerRecent: boolean;
  isRecentLoading: boolean;
  onRecentPress: (recentSearch: RecentSearch) => void;
  onLocalRecentPress: (recentLookup: LocalRecentLookup) => void;
  locationMessage: string | null;
};

/**
 * All map chrome that lives above the sheet. Owns the swap between the resting
 * search pill and the full-screen search panel. Category chips live in the sheet's
 * Business tab only — a second row up here duplicated them over the map.
 */
export function SearchOverlay({
  topInset,
  isPanelOpen,
  onOpenPanel,
  onClosePanel,
  query,
  placeholder,
  onChangeText,
  onClearQuery,
  onSubmit,
  onAccountPress,
  onVoicePress,
  suggestions,
  isSuggestionsLoading,
  suggestionsError,
  onSuggestionPress,
  recentSearches,
  localRecentLookups,
  showServerRecent,
  isRecentLoading,
  onRecentPress,
  onLocalRecentPress,
  locationMessage,
}: SearchOverlayProps) {
  if (isPanelOpen) {
    return (
      <SearchPanel
        topInset={topInset}
        query={query}
        placeholder={placeholder}
        onChangeText={onChangeText}
        onClose={onClosePanel}
        onSubmit={onSubmit}
        suggestions={suggestions}
        isSuggestionsLoading={isSuggestionsLoading}
        suggestionsError={suggestionsError}
        onSuggestionPress={onSuggestionPress}
        recentSearches={recentSearches}
        localRecentLookups={localRecentLookups}
        showServerRecent={showServerRecent}
        isRecentLoading={isRecentLoading}
        onRecentPress={onRecentPress}
        onLocalRecentPress={onLocalRecentPress}
      />
    );
  }

  return (
    <View style={[styles.root, { paddingTop: topInset + spacing.sm }]}>
      <View style={styles.inset}>
        <MapSearchBar
          value={query}
          placeholder={placeholder}
          onPress={onOpenPanel}
          onClear={onClearQuery}
          onAccountPress={onAccountPress}
          onVoicePress={onVoicePress}
        />
      </View>

      {locationMessage ? (
        <View style={styles.inset}>
          <View style={styles.notice}>
            <MapErrorState message={locationMessage} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 6,
    gap: spacing.md,
  },
  inset: {
    paddingHorizontal: spacing.lg,
  },
  notice: {
    overflow: 'hidden',
    borderRadius: mapShape.medium,
    backgroundColor: mapColors.surface,
    ...mapElevation.level2,
  },
});
