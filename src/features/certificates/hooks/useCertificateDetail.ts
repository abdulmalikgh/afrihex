import { useQuery } from '@tanstack/react-query';

import {
  getCertificate,
  verifyCertificate,
  type CertificateDetail,
  type CertificateVerification,
} from '../../../api/certificates';
import { useAuthSession } from '../../authentication/context/AuthSessionProvider';
import type { CertificateHeroStatus } from '../components/CertificateStatusCard';
import {
  deriveCertificateHeroStatus,
  isCertificateNotFoundError,
} from '../utils/certificateStatus';

export type CertificateDetailState = {
  status: CertificateHeroStatus | 'loading';
  verification?: CertificateVerification;
  detail?: CertificateDetail;
  /** True while the viewer is signed in and the full payload is still arriving. */
  isDetailLoading: boolean;
  /**
   * Why the rich sections are absent, when they are. Lets the screen say
   * "sign in to see more" rather than silently showing a thinner page.
   */
  detailUnavailableReason?: 'anonymous' | 'withheld';
  refetch: () => void;
};

export function useCertificateDetail(certificateId: string): CertificateDetailState {
  const { status: authStatus } = useAuthSession();
  const isAuthenticated = authStatus === 'authenticated';

  const verifyQuery = useQuery({
    queryKey: ['certificates', 'verify', certificateId],
    queryFn: () => verifyCertificate(certificateId),
    staleTime: 5 * 60_000,
    // A missing certificate is an answer, not a transient failure.
    retry: (failureCount, error) => !isCertificateNotFoundError(error) && failureCount < 1,
  });

  const status = deriveCertificateHeroStatus(
    verifyQuery.isFetching,
    verifyQuery.error,
    verifyQuery.data,
  );

  // Withheld for anything but a valid certificate, even to a signed-in viewer.
  // The web does the same deliberately: a revoked or forged certificate's
  // subject and address are exactly what a misuser would want, and nobody
  // should be acting on those details anyway.
  const canLoadDetail = isAuthenticated && status === 'valid';

  const detailQuery = useQuery({
    queryKey: ['certificates', 'detail', certificateId],
    queryFn: () => getCertificate(certificateId),
    enabled: canLoadDetail,
    staleTime: 5 * 60_000,
    retry: 0,
  });

  return {
    status,
    verification: verifyQuery.data,
    detail: detailQuery.data,
    isDetailLoading: canLoadDetail && detailQuery.isPending,
    detailUnavailableReason: resolveUnavailableReason(status, isAuthenticated),
    refetch: () => {
      void verifyQuery.refetch();

      if (canLoadDetail) {
        void detailQuery.refetch();
      }
    },
  };
}

function resolveUnavailableReason(
  status: CertificateHeroStatus | 'loading',
  isAuthenticated: boolean,
) {
  if (status !== 'valid') {
    return status === 'loading' ? undefined : 'withheld';
  }

  return isAuthenticated ? undefined : 'anonymous';
}
