import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Check, LocateFixed, MapPin } from 'lucide-react-native';

import { AppText } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { fontFamilies, fontSizes } from '../../../constants/typography';
import type { AutocompleteResult } from '../../../api/search';
import type { BusinessLocation } from '../hooks/useBusinessLocation';

/** Names every input the resolver behind this field actually accepts. */
export const LOCATION_PLACEHOLDER = 'Place name, AfriHex code, hex code or lat, lng';

type BusinessLocationFieldProps = {
  query: string;
  onChangeQuery: (value: string) => void;
  onSubmitQuery: () => void;
  location: BusinessLocation | null;
  suggestions: AutocompleteResult[];
  isSearching: boolean;
  isLocating: boolean;
  isResolving: boolean;
  message: string | null;
  placeholder?: string;
  onSelectSuggestion: (suggestion: AutocompleteResult) => void;
  onUseDeviceLocation: () => void;
  onClear: () => void;
};

/**
 * One field for a location, with the device-position button inside it — the same
 * shape the Directions endpoints use, so a location input looks like a location
 * input everywhere in the app.
 *
 * The field stays an input after something resolves rather than collapsing into
 * a confirmation row: editing what you typed should not require undoing a state
 * change first. What resolved is shown underneath instead.
 */
export function BusinessLocationField({
  query,
  onChangeQuery,
  onSubmitQuery,
  location,
  suggestions,
  isSearching,
  isLocating,
  isResolving,
  message,
  placeholder = LOCATION_PLACEHOLDER,
  onSelectSuggestion,
  onUseDeviceLocation,
  onClear,
}: BusinessLocationFieldProps) {
  const busy = isSearching || isResolving;

  return (
    <View style={styles.container}>
      <View style={styles.field}>
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          onSubmitEditing={onSubmitQuery}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          selectionColor={colors.primaryLight}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Location"
          accessibilityHint="Enter a place name, a code, or coordinates"
          style={styles.input}
        />

        {busy ? <ActivityIndicator size="small" color={colors.primaryLight} /> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use my current location"
          accessibilityState={{ busy: isLocating, disabled: isLocating }}
          disabled={isLocating}
          onPress={onUseDeviceLocation}
          hitSlop={8}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color={colors.primaryLight} />
          ) : (
            <LocateFixed color={colors.primaryLight} size={20} />
          )}
        </Pressable>
      </View>

      {suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={`${suggestion.name}-${suggestion.latitude}-${suggestion.longitude}`}
              accessibilityRole="button"
              accessibilityLabel={suggestion.display_name || suggestion.name}
              onPress={() => onSelectSuggestion(suggestion)}
              style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
            >
              <MapPin color={colors.muted} size={18} />
              <View style={styles.suggestionText}>
                <AppText variant="body" numberOfLines={1}>
                  {suggestion.name}
                </AppText>
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {suggestion.display_name}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Confirmation sits under the field, not in place of it: the coordinates
          are what actually gets submitted, so they are worth showing. */}
      {location ? (
        <View style={styles.resolved}>
          <Check color={colors.primaryLight} size={16} />
          <AppText variant="caption" tone="muted" numberOfLines={2} style={styles.resolvedText}>
            {location.label} · {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear the location"
            onPress={onClear}
            hitSlop={8}
          >
            <AppText variant="caption" tone="primary">
              Clear
            </AppText>
          </Pressable>
        </View>
      ) : null}

      {message ? (
        <AppText variant="caption" tone="danger">
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBg,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.base,
    paddingVertical: spacing.md,
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestions: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    overflow: 'hidden',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  suggestionText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  resolved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resolvedText: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.7,
  },
});
