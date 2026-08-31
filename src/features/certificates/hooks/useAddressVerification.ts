import { useCallback, useState } from 'react';

import { getCurrentUser } from '../../../api/auth';
import { ApiRequestError } from '../../../api/client';
import { verifyAddress, type KycVerificationResult } from '../../../api/kyc';
import { useAuthSession } from '../../authentication/context/AuthSessionProvider';
import type { AddressTarget } from './useAddressTarget';

/**
 * `session` means this device's key is dead and signing in again fixes it.
 * `entitlement` means the key is live but this endpoint will not accept it —
 * nothing the user can do from here, so we say so plainly instead of sending
 * them round a sign-in loop that cannot help.
 */
export type AddressVerificationErrorKind = 'session' | 'entitlement' | 'request';

export type AddressVerificationState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; result: KycVerificationResult }
  | { status: 'error'; kind: AddressVerificationErrorKind; message: string };

export function useAddressVerification() {
  const { user } = useAuthSession();
  const [state, setState] = useState<AddressVerificationState>({ status: 'idle' });

  const verify = useCallback(
    async (target: AddressTarget) => {
      // `/v2/me` returns a narrower object than login does and omits `id`, so a
      // session restored from it alone has no customer id to send. Saying so
      // beats a 400 the user cannot act on.
      if (typeof user?.id !== 'number') {
        setState({
          status: 'error',
          kind: 'session',
          message: 'Your account details could not be read. Sign in again, then try once more.',
        });
        return;
      }

      setState({ status: 'submitting' });

      try {
        // The method stays faithful to how they actually entered it: a typed
        // code is verified as a code, a device fix as coordinates, even though
        // we hold both by this point.
        const result = await verifyAddress(
          target.source === 'gps_code'
            ? {
                customer_id: String(user.id),
                method: 'gps_code',
                location: { gps_code: target.gpsCode },
              }
            : {
                customer_id: String(user.id),
                method: 'gps_fix',
                location: { lat: target.lat, lng: target.lng },
              },
        );

        setState({ status: 'success', result });
      } catch (error) {
        setState(await describeFailure(error));
      }
    },
    [user?.id],
  );

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, verify, reset };
}

/**
 * An `INVALID_API_KEY` from this endpoint has two very different causes, and
 * the response alone cannot tell them apart — so we ask a second endpoint.
 *
 * If `/v2/me` accepts the same key, the key is alive and it is this endpoint
 * that will not take it: telling the user to sign in again would send them
 * round a loop that cannot succeed. If `/v2/me` rejects it too, the session is
 * simply dead and signing in again is the whole fix.
 */
async function describeFailure(error: unknown): Promise<AddressVerificationState> {
  if (!isAuthError(error)) {
    return {
      status: 'error',
      kind: 'request',
      message: error instanceof Error ? error.message : 'The address could not be verified.',
    };
  }

  const sessionAlive = await isSessionStillValid();

  if (sessionAlive) {
    return {
      status: 'error',
      kind: 'entitlement',
      message:
        'Your sign-in is valid, but this account is not enabled for address verification. ' +
        'This needs to be turned on for your API key — it cannot be fixed from the app.',
    };
  }

  return {
    status: 'error',
    kind: 'session',
    message: 'Your session has expired. Sign in again, then try once more.',
  };
}

async function isSessionStillValid() {
  try {
    await getCurrentUser();
    return true;
  } catch (error) {
    return !isAuthError(error);
  }
}

function isAuthError(error: unknown) {
  return (
    error instanceof ApiRequestError &&
    (error.code === 'INVALID_API_KEY' || error.code === 'MISSING_API_KEY' || error.status === 401)
  );
}
