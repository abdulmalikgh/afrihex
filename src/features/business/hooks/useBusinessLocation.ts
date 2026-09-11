import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

import { autocompleteSearch, type AutocompleteResult } from '../../../api/search';
import {
  OUTSIDE_GHANA_MESSAGE,
  isWithinGhana,
  resolveAddressQuery,
} from '../../../utils/resolveAddressQuery';

export type BusinessLocation = {
  lat: number;
  lng: number;
  label: string;
};

/**
 * The location field for a business submission.
 *
 * `/v2/landmarks/submit` takes raw coordinates and nothing else — it neither
 * asks for nor returns a resolved address — so there is no reverse-geocode step
 * here. Both paths end at a `lat`/`lng` pair: pick an autocomplete result (each
 * already carries coordinates, no second call) or use the device position.
 */
export function useBusinessLocation() {
  const [location, setLocation] = useState<BusinessLocation | null>(null);
  const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const search = useCallback(async (query: string, deviceHint?: { lat: number; lng: number }) => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsSearching(true);

    try {
      const response = await autocompleteSearch({
        q: trimmed,
        limit: 8,
        // Biases toward what is near the phone, which for someone registering
        // their own shop is almost always the right answer.
        ...(deviceHint ? { lat: deviceHint.lat, lng: deviceHint.lng } : {}),
      });

      setSuggestions(response.results);
    } catch {
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  /**
   * Resolves whatever was typed, using the same chain Find and Directions use —
   * an AfriHex code, a hex code, a coordinate pair or free text all land here.
   * The field advertises all four, so it has to accept all four; autocomplete
   * alone would only cover the last of them.
   */
  const submit = useCallback(async (query: string) => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      return;
    }

    setIsResolving(true);
    setMessage(null);

    try {
      const resolution = await resolveAddressQuery(trimmed);

      if (resolution.status === 'empty') {
        setMessage(
          resolution.didYouMean
            ? `Nothing matched. Did you mean ${resolution.didYouMean}?`
            : 'Nothing matched that. Try a place name, a code, or lat, lng.',
        );
        return;
      }

      setLocation({
        lat: resolution.result.latitude,
        lng: resolution.result.longitude,
        label: resolution.result.displayName,
      });
      setSuggestions([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not find that place.');
    } finally {
      setIsResolving(false);
    }
  }, []);

  const selectSuggestion = useCallback((suggestion: AutocompleteResult) => {
    setLocation({
      lat: suggestion.latitude,
      lng: suggestion.longitude,
      label: suggestion.display_name || suggestion.name,
    });
    setSuggestions([]);
    setMessage(null);
  }, []);

  /**
   * Permission-denied, unavailable and timeout are surfaced as distinct
   * messages: an owner standing in their shop with GPS blocked should be told
   * that, not left on a spinner.
   */
  const useDeviceLocation = useCallback(async () => {
    setIsLocating(true);
    setMessage(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        setMessage(
          permission.canAskAgain
            ? 'Location permission is off. Allow it, or search for the place instead.'
            : 'Location is blocked for AfriHex. Enable it in Settings, or search for the place instead.',
        );
        return null;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;

      if (!isWithinGhana(latitude, longitude)) {
        setMessage(OUTSIDE_GHANA_MESSAGE);
        return null;
      }

      const next = { lat: latitude, lng: longitude, label: 'Your current location' };
      setLocation(next);
      setSuggestions([]);

      return next;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not read your location.');
      return null;
    } finally {
      setIsLocating(false);
    }
  }, []);

  const clear = useCallback(() => {
    setLocation(null);
    setSuggestions([]);
    setMessage(null);
  }, []);

  return {
    location,
    suggestions,
    isSearching,
    isLocating,
    isResolving,
    message,
    search,
    submit,
    selectSuggestion,
    useDeviceLocation,
    clear,
  };
}
