import { useCallback, useState } from 'react';

import { ApiRequestError } from '../../../api/client';
import { planRoute, type RouteRequest } from '../../../api/route';
import { isInvalidSessionError } from '../../authentication/context/AuthSessionProvider';
import { toPlannedRoute, type DirectionsState } from '../types/directions';

/** Plans a route and classifies `404 NO_ROUTE` separately from other failures. */
export function useDirectionsPlanner(isAuthenticated: boolean) {
  const [state, setState] = useState<DirectionsState>({ status: 'idle' });

  const plan = useCallback(
    async (request: RouteRequest) => {
      setState({ status: 'loading' });

      try {
        let response;

        try {
          response = await planRoute(request, isAuthenticated);
        } catch (error) {
          // A stored key can be expired or revoked while the app still considers
          // itself signed in — nothing validates it at launch. Rather than dead-end
          // on "the provided API key is not valid", fall back to the public
          // endpoint, which serves the same routes at the anonymous quota.
          if (!isAuthenticated || !isInvalidSessionError(error)) {
            throw error;
          }

          response = await planRoute(request, false);
        }

        setState({ status: 'success', route: toPlannedRoute(response) });
      } catch (error) {
        if (error instanceof ApiRequestError && (error.status === 404 || error.code === 'NO_ROUTE')) {
          setState({
            status: 'noRoute',
            message: 'No route could be found between these points.',
          });
          return;
        }

        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Could not plan a route. Try again.',
        });
      }
    },
    [isAuthenticated],
  );

  const reset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  return { state, plan, reset };
}
