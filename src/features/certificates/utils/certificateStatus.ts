import type { CertificateVerification } from '../../../api/certificates';
import { ApiRequestError } from '../../../api/client';
import type { CertificateHeroStatus } from '../components/CertificateStatusCard';

/**
 * The document's status, from the query that asked for it.
 *
 * `valid` is the server's roll-up of `signature_valid && !revoked`, so a
 * certificate that is both revoked and unverifiable reports as revoked — the
 * fact the holder needs first. There is deliberately no expired state:
 * certificates carry no expiry.
 */
export function deriveCertificateHeroStatus(
  isFetching: boolean,
  error: unknown,
  data: CertificateVerification | undefined,
): CertificateHeroStatus | 'loading' {
  if (isFetching) {
    return 'loading';
  }

  if (error) {
    return isCertificateNotFoundError(error) ? 'not_found' : 'error';
  }

  if (!data) {
    return 'loading';
  }

  if (data.valid) {
    return 'valid';
  }

  return data.revoked ? 'revoked' : 'signature_invalid';
}

/**
 * The server answers an unknown or malformed ID with a 404 rather than a
 * `valid: false` body, which makes "no such certificate" a statement about the
 * ID someone typed rather than a verdict on a document.
 */
export function isCertificateNotFoundError(error: unknown) {
  return error instanceof ApiRequestError && (error.status === 404 || error.code === 'NOT_FOUND');
}

/** Timestamps arrive as RFC3339 UTC. Renders as "1 August 2026". */
export function formatCertificateDate(value: string | undefined) {
  const parsed = parseTimestamp(value);

  return parsed?.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Renders as "1 August 2026, 09:00". Revocation is the one moment where the
 * time of day matters — it tells the holder whether a certificate died before
 * or after the transaction they are asking about.
 */
export function formatCertificateTimestamp(value: string | undefined) {
  const parsed = parseTimestamp(value);

  if (!parsed) {
    return undefined;
  }

  const date = parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const time = parsed.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${date}, ${time}`;
}

/** Returns undefined rather than an "Invalid Date" string the UI would render. */
function parseTimestamp(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
