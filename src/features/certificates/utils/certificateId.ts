/**
 * Real certificate IDs are `cert_` followed by **up to** 12 alphanumerics, e.g.
 * `cert_GPU4XBpCp7q` — which is 11. The server encodes 9 random bytes as
 * base64url, strips the `-` and `_` characters, and only then truncates to 12,
 * so any ID that happened to encode those characters comes out shorter.
 * Matching exactly 12 would reject genuine IDs.
 *
 * The `GH-CERT-ABC123` form in older API notes is a placeholder, never issued.
 */
const CERTIFICATE_ID_PATTERN = /^cert_[A-Za-z0-9]{1,12}$/;

/**
 * A certificate QR encodes `{base}/v2/certificates/{id}/verify`, not a bare ID.
 * The second form is the public web page — the link this app shares and the one
 * a person is most likely to paste back in.
 */
const CERTIFICATE_URL_PATTERNS = [
  /\/v2\/certificates\/([^/?#]+)\/verify/,
  /\/certificate\/([^/?#]+)/,
];

/**
 * Trims surrounding whitespace and nothing else. Case is deliberately left
 * alone: IDs are matched exactly by the server, so `cert_gpu4xbpcp7q` and
 * `cert_GPU4XBpCp7q` are different certificates and "helpfully" upper-casing
 * user input would turn a valid ID into a 404.
 */
export function normalizeCertificateId(value: string) {
  return value.trim();
}

export function isWellFormedCertificateId(value: string) {
  return CERTIFICATE_ID_PATTERN.test(value);
}

/**
 * Reads a certificate ID out of a scanned QR code. Handles the verification URL
 * the certificate PDF actually encodes, and a bare ID as well, so a code someone
 * re-encoded by hand still works.
 *
 * A URL in the right shape is trusted on its own — the server is the authority
 * on whether the ID exists, and pattern-matching the ID here would break the
 * scanner the day the ID format changes. A bare string must look like an ID,
 * so that scanning an unrelated QR code keeps the camera scanning instead of
 * sending someone's Wi-Fi credentials to the verification endpoint.
 */
export function extractCertificateId(scannedValue: string): string | null {
  const value = normalizeCertificateId(scannedValue);

  if (isWellFormedCertificateId(value)) {
    return value;
  }

  for (const pattern of CERTIFICATE_URL_PATTERNS) {
    const match = value.match(pattern);

    if (match) {
      const candidate = safeDecode(match[1]);

      return candidate ? candidate : null;
    }
  }

  return null;
}

/**
 * A scanned string is arbitrary input — a stray `%` makes `decodeURIComponent`
 * throw, which would crash the scan handler rather than rejecting the code.
 */
function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
