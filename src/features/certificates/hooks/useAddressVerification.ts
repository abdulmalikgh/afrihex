import { useCallback, useState } from 'react';

import { ApiRequestError } from '../../../api/client';
import { verifyAddress, type KycVerificationResult } from '../../../api/kyc';
import { useAuthSession } from '../../authentication/context/AuthSessionProvider';

/**
 * What the user is about to have checked. One of the two input methods the
 * feature builds — the endpoint accepts four, but `hex_code` and `manual` have
 * no mobile use case.
 */
export type VerificationTarget =
  | { method: 'gps_fix'; lat: number; lng: number; accuracyM?: number }
  | { method: 'gps_code'; gpsCode: string };

/** `session` is the only failure the user can act on, and the action is signing in again. */
export type AddressVerificationErrorKind = 'session' | 'request';

export type AddressVerificationState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; result: KycVerificationResult }
  | { status: 'error'; kind: AddressVerificationErrorKind; message: string };

export function useAddressVerification() {
  const { user } = useAuthSession();
  const [state, setState] = useState<AddressVerificationState>({ status: 'idle' });

  const verify = useCallback(
    async (target: VerificationTarget) => {
      // A session restored from `/v2/me` carries no `id`, so there is no customer
      // id to send. Saying so beats a 400 the user cannot act on.
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
        // The method stays faithful to how they entered it: a typed code is
        // verified as a code, a device fix as coordinates.
        const result = await verifyAddress(
          target.method === 'gps_code'
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
        setState(describeFailure(error));
      }
    },
    [user?.id],
  );

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, verify, reset };
}

function describeFailure(error: unknown): AddressVerificationState {
  if (isAuthError(error)) {
    return {
      status: 'error',
      kind: 'session',
      message: 'Your sign-in was rejected for this check. Sign in again, then try once more.',
    };
  }

  return {
    status: 'error',
    kind: 'request',
    message: error instanceof Error ? error.message : 'The address could not be verified.',
  };
}

function isAuthError(error: unknown) {
  return (
    error instanceof ApiRequestError &&
    (error.code === 'INVALID_API_KEY' || error.code === 'MISSING_API_KEY' || error.status === 401)
  );
}
