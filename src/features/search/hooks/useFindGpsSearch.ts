import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { recordRecentSearch, type RecentSearchResultType } from '../../../api/search';
import {
  resolveAddressQuery,
  resolveCoordinates,
  type ResolvedFindGpsResult,
} from '../../../utils/resolveAddressQuery';

export type { ResolvedFindGpsResult } from '../../../utils/resolveAddressQuery';

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
        const resolution = await resolveAddressQuery(query);

        if (resolution.status === 'empty') {
          setState({ status: 'empty', query, didYouMean: resolution.didYouMean });
          return;
        }

        setState({ status: 'success', query, result: resolution.result });
        rememberResult(query, resolution.result, resolution.resultType);
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
        const result = await resolveCoordinates(latitude, longitude);
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

  const reset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  return {
    state,
    submit,
    resolveCurrentLocation,
    reset,
    isRecordingRecentSearch: recentSearchMutation.isPending,
  };
}
