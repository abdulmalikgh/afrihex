import { useCallback, useState } from 'react';

import {
  resolveAddressQuery,
  resolveCoordinates,
  type ResolvedFindGpsResult,
} from '../../../utils/resolveAddressQuery';

export type RouteEndpointState =
  | { status: 'idle' }
  | { status: 'loading'; label: string }
  | { status: 'resolved'; label: string; result: ResolvedFindGpsResult }
  | { status: 'empty'; label: string; didYouMean?: string }
  | { status: 'error'; label: string; message: string };

type UseRouteEndpointSearchOptions = {
  onResolved?: (label: string, result: ResolvedFindGpsResult) => void;
};

/**
 * Resolves a single From/To field using the same GPS-code / hex-code / free-text
 * fallback chain FindGPS uses (`resolveAddressQuery`), plus map-tap and current-location
 * resolution. Directions uses two independent instances of this hook, one per field.
 */
export function useRouteEndpointSearch({ onResolved }: UseRouteEndpointSearchOptions = {}) {
  const [state, setState] = useState<RouteEndpointState>({ status: 'idle' });

  const submit = useCallback(
    async (rawLabel: string) => {
      const label = rawLabel.trim();

      if (label.length < 2) {
        setState({ status: 'empty', label });
        return;
      }

      setState({ status: 'loading', label });

      try {
        const resolution = await resolveAddressQuery(label);

        if (resolution.status === 'empty') {
          setState({ status: 'empty', label, didYouMean: resolution.didYouMean });
          return;
        }

        setState({ status: 'resolved', label, result: resolution.result });
        onResolved?.(label, resolution.result);
      } catch (error) {
        setState({
          status: 'error',
          label,
          message: error instanceof Error ? error.message : 'Could not resolve this location.',
        });
      }
    },
    [onResolved],
  );

  const resolveFromCoordinates = useCallback(
    async (label: string, lat: number, lng: number) => {
      setState({ status: 'loading', label });

      try {
        const result = await resolveCoordinates(lat, lng);
        const resolvedLabel = label || result.displayName;
        setState({ status: 'resolved', label: resolvedLabel, result });
        onResolved?.(resolvedLabel, result);
      } catch (error) {
        setState({
          status: 'error',
          label,
          message: error instanceof Error ? error.message : 'Could not resolve this location.',
        });
      }
    },
    [onResolved],
  );

  const setResolved = useCallback((label: string, result: ResolvedFindGpsResult) => {
    setState({ status: 'resolved', label, result });
  }, []);

  const reset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  return { state, submit, resolveFromCoordinates, setResolved, reset };
}
