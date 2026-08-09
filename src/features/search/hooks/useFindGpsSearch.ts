import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  geocodeLandmarks,
  lookupAddress,
  parseAddress,
  recordRecentSearch,
  reverseLookup,
  searchPlaces,
  type LocationLookupResponse,
  type RecentSearchResultType,
  type SearchResult,
} from '../../../api/search';

export type ResolvedFindGpsResult = {
  gpsCode: string;
  displayName: string;
  latitude: number;
  longitude: number;
  region?: string;
  district?: string;
  area?: string;
  postcode?: string;
  qualityScore?: number;
  googleMapsUrl?: string;
  source: 'lookup' | 'search' | 'reverse';
};

export type FindGpsState =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'success'; query: string; result: ResolvedFindGpsResult }
  | { status: 'empty'; query: string; didYouMean?: string }
  | { status: 'error'; query: string; message: string };

type UseFindGpsSearchOptions = {
  isAuthenticated: boolean;
  onResolved?: (query: string, result: ResolvedFindGpsResult) => void;
};

export function useFindGpsSearch({ isAuthenticated, onResolved }: UseFindGpsSearchOptions) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<FindGpsState>({ status: 'idle' });

  const recentSearchMutation = useMutation({
    mutationFn: recordRecentSearch,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['search', 'recent'] });
    },
  });

  const rememberResult = useCallback(
    (query: string, result: ResolvedFindGpsResult, resultType: RecentSearchResultType) => {
      onResolved?.(query, result);

      if (!isAuthenticated) {
        return;
      }

      recentSearchMutation.mutate({
        query,
        result_type: resultType,
        result_ref: result.gpsCode,
        display_name: result.displayName,
        lat: result.latitude,
        lng: result.longitude,
      });
    },
    [isAuthenticated, onResolved, recentSearchMutation],
  );

  const submit = useCallback(
    async (rawQuery: string) => {
      const query = rawQuery.trim();

      if (query.length < 2) {
        setState({ status: 'empty', query, didYouMean: undefined });
        return;
      }

      setState({ status: 'loading', query });

      try {
        if (isCodeLike(query)) {
          const lookup = await lookupAddress(query);
          const result = mapLookupResult(lookup, 'lookup');
          setState({ status: 'success', query, result });
          rememberResult(query, result, 'gps');
          return;
        }

        const parsedAddress = await parseAddress(query);
        const parsedCode = getParsedCode(parsedAddress.parsed);

        if (parsedAddress.is_code && parsedCode) {
          const lookup = await lookupAddress(parsedCode);
          const result = mapLookupResult(lookup, 'lookup');
          setState({ status: 'success', query, result });
          rememberResult(query, result, 'gps');
          return;
        }

        const geocodeQuery = getParsedGeocodeQuery(parsedAddress.parsed) ?? query;
        const searchResponse = await searchPlaces({ q: geocodeQuery, limit: 1 });
        const firstSearchResult = searchResponse.results[0];

        if (firstSearchResult?.gps_name) {
          const lookup = await lookupAddress(firstSearchResult.gps_name);
          const result = mapLookupResult(lookup, 'lookup', firstSearchResult.name);
          setState({ status: 'success', query, result });
          rememberResult(query, result, getSearchResultType(firstSearchResult));
          return;
        }

        if (firstSearchResult) {
          const lookup = await reverseLookup({
            lat: firstSearchResult.latitude,
            lng: firstSearchResult.longitude,
          });
          const result = mapLookupResult(lookup, 'reverse', firstSearchResult.name);
          setState({ status: 'success', query, result });
          rememberResult(query, result, getSearchResultType(firstSearchResult));
          return;
        }

        for (const anchor of parsedAddress.parsed.anchors ?? []) {
          const anchorResponse = await geocodeLandmarks({ q: anchor.name, limit: 3 });
          const firstMatch = anchorResponse.matches[0];

          if (firstMatch) {
            const lookup = await reverseLookup({
              lat: firstMatch.centroid.lat,
              lng: firstMatch.centroid.lng,
            });
            const result = mapLookupResult(lookup, 'reverse', firstMatch.name);
            setState({ status: 'success', query, result });
            rememberResult(query, result, 'landmark');
            return;
          }
        }

        setState({ status: 'empty', query, didYouMean: searchResponse.did_you_mean });
      } catch (error) {
        setState({
          status: 'error',
          query,
          message: error instanceof Error ? error.message : 'Search failed. Try again.',
        });
      }
    },
    [rememberResult],
  );

  const resolveCurrentLocation = useCallback(
    async ({ latitude, longitude }: { latitude: number; longitude: number }) => {
      const query = 'Current location';
      setState({ status: 'loading', query });

      try {
        const lookup = await reverseLookup({ lat: latitude, lng: longitude });
        const result = mapLookupResult(lookup, 'reverse');
        setState({ status: 'success', query, result });
        rememberResult(query, result, 'gps');
      } catch (error) {
        setState({
          status: 'error',
          query,
          message: error instanceof Error ? error.message : 'Could not resolve your location.',
        });
      }
    },
    [rememberResult],
  );

  return {
    state,
    submit,
    resolveCurrentLocation,
    isRecordingRecentSearch: recentSearchMutation.isPending,
  };
}

function mapLookupResult(
  lookup: LocationLookupResponse,
  source: ResolvedFindGpsResult['source'],
  displayNameOverride?: string,
): ResolvedFindGpsResult {
  const locality = [lookup.street, lookup.area, lookup.district, lookup.region]
    .filter(Boolean)
    .join(', ');

  return {
    gpsCode: lookup.gps_name,
    displayName: displayNameOverride ?? (locality || lookup.address),
    latitude: lookup.center_latitude,
    longitude: lookup.center_longitude,
    region: lookup.region,
    district: lookup.district,
    area: lookup.area,
    postcode: lookup.postcode,
    qualityScore: lookup.quality_score,
    googleMapsUrl: lookup.google_maps_url,
    source,
  };
}

function isCodeLike(query: string) {
  const normalized = query.trim().toUpperCase();

  return (
    /^[A-Z]{1,4}-?\d{3}-?\d{4}$/.test(normalized) ||
    /^AF-GH-[A-Z0-9-]+$/.test(normalized)
  );
}

function getParsedCode(parsed: Record<string, unknown>) {
  return getString(parsed.gps_name) ?? getString(parsed.gps_code) ?? getString(parsed.code);
}

function getParsedGeocodeQuery(parsed: Record<string, unknown>) {
  return getString(parsed.geocode_query);
}

function getSearchResultType(result: SearchResult): RecentSearchResultType {
  if (result.type === 'landmark') {
    return 'landmark';
  }

  if (result.gps_name) {
    return 'place';
  }

  return 'place';
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}
