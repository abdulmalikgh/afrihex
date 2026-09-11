import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ArrowLeft, MapPin, Mic, Search, X } from 'lucide-react-native';

import { AppText } from '../../../components';
import { mapColors, mapElevation, mapPressedLayer, mapShape, mapSize } from '../../../constants/material';
import { spacing } from '../../../constants/spacing';
import { useVoiceInput } from '../../navigation/hooks/useVoiceInput';
import { fontFamilies, fontSizes } from '../../../constants/typography';
import type { AutocompleteResult, RecentSearch } from '../../../api/search';
import { MapCard, MapDivider, MapListRow, MapSectionHeader } from './MapListRow';
import { MapErrorState } from './MapStates';
import { RecentLookups, type LocalRecentLookup } from './RecentLookups';

type SearchPanelProps = {
  topInset: number;
  query: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  onClose: () => void;
  onSubmit: (query: string) => void;
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
};

/** Below this the query is too short for the autocomplete endpoint to be useful. */
const MIN_SUGGESTION_LENGTH = 2;

/**
 * The focused state of search: a full-screen sheet that replaces the map chrome
 * with a real text field, recents while the field is short, and live suggestions
 * once there is something to complete. Kept separate from the resting pill so the
 * map never has to re-layout around a keyboard.
 */
export function SearchPanel({
  topInset,
  query,
  placeholder,
  onChangeText,
  onClose,
  onSubmit,
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
}: SearchPanelProps) {
  const trimmedQuery = query.trim();
  const voice = useVoiceInput({
    // Straight into the field, then submitted — the same path a typed query
    // takes, so codes and coordinates still resolve the way they always did.
    onTranscript: (text) => {
      onChangeText(text);
      onSubmit(text);
    },
  });
  const isSearching = trimmedQuery.length >= MIN_SUGGESTION_LENGTH;

  return (
    <View style={[styles.panel, { paddingTop: topInset + spacing.sm }]}>
      <View style={styles.searchBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close search"
          onPress={onClose}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <ArrowLeft color={mapColors.onSurface} size={22} />
        </Pressable>

        <TextInput
          value={query}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={mapColors.onSurfaceVariant}
          selectionColor={mapColors.primary}
          accessibilityLabel="Search place, GPS code, or address"
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => onSubmit(query)}
          style={styles.input}
        />

        {isSuggestionsLoading || voice.isParsing ? (
          <ActivityIndicator size="small" color={mapColors.primary} />
        ) : null}

        {/* Dictation fills this field rather than opening anything — speaking a
            place and typing one should land in the same box. Shown even when the
            native recogniser is absent, so tapping it can say so. */}
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={voice.isListening ? 'Stop listening' : 'Speak a place'}
            accessibilityState={{ busy: voice.isListening }}
            onPress={voice.toggle}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Mic color={voice.isListening ? mapColors.primary : mapColors.onSurfaceVariant} size={20} />
        </Pressable>

        {trimmedQuery.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search text"
            onPress={() => onChangeText('')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <X color={mapColors.onSurfaceVariant} size={20} />
          </Pressable>
        ) : (
          <View style={styles.iconButton}>
            <Search color={mapColors.onSurfaceVariant} size={20} />
          </View>
        )}
      </View>

      {voice.errorMessage ? (
        <AppText variant="caption" tone="danger" style={styles.voiceError}>
          {voice.errorMessage}
        </AppText>
      ) : null}

      <ScrollView
        style={styles.results}
        contentContainerStyle={styles.resultsContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {isSearching ? (
          <MapCard>
            <MapListRow
              icon={<Search color={mapColors.onSurfaceVariant} size={20} />}
              title={`Search "${trimmedQuery}"`}
              subtitle="Place, landmark, or GPS code"
              onPress={() => onSubmit(query)}
            />
            {suggestions.map((suggestion) => (
              <View key={`${suggestion.name}-${suggestion.latitude}-${suggestion.longitude}`}>
                <MapDivider />
                <MapListRow
                  icon={<MapPin color={mapColors.onSurfaceVariant} size={20} />}
                  title={suggestion.name}
                  subtitle={suggestion.display_name}
                  onPress={() => onSuggestionPress(suggestion)}
                />
              </View>
            ))}
          </MapCard>
        ) : (
          <>
            <MapSectionHeader title="Recent" />
            <MapCard>
              <RecentLookups
                recentSearches={recentSearches}
                localRecentLookups={localRecentLookups}
                showServerRecent={showServerRecent}
                isLoading={isRecentLoading}
                onRecentPress={onRecentPress}
                onLocalRecentPress={onLocalRecentPress}
              />
            </MapCard>
          </>
        )}

        {suggestionsError ? <MapErrorState message={suggestionsError} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    ...StyleSheet.absoluteFill,
    zIndex: 30,
    backgroundColor: mapColors.surfaceContainerLow,
  },
  searchBar: {
    minHeight: mapSize.searchBar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    borderRadius: mapShape.full,
    backgroundColor: mapColors.surface,
    paddingHorizontal: spacing.xs,
    ...mapElevation.level2,
  },
  voiceError: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  iconButton: {
    width: mapSize.iconButton,
    height: mapSize.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: mapShape.full,
  },
  pressed: {
    backgroundColor: mapPressedLayer,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: mapSize.searchBar,
    color: mapColors.onSurface,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.base,
    paddingVertical: 0,
  },
  results: {
    flex: 1,
    marginTop: spacing.md,
  },
  resultsContent: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
});
