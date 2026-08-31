import { API_BASE_URL, apiRequest, getOptionalNumber, getOptionalString, isObject } from './client';

/**
 * The public web app, which hosts the human-readable verification page for a
 * certificate. Separate from the API base URL — the API returns JSON, and a
 * link a person is meant to open has to land somewhere they can read.
 */
export const CERTIFICATE_WEB_BASE_URL = 'https://maps.afrihex.com';

/**
 * The `/verify` payload — public, unauthenticated, and the entire anonymous
 * verification surface. The richer `GET /v2/certificates/{id}` payload (subject,
 * confidence, address, integrity) is authenticated and deliberately not used
 * here: certificate IDs are shared freely, so gating that data keeps customer
 * IDs and declared addresses from being enumerable by anyone holding an ID.
 */
export type CertificateVerification = {
  certificate_id: string;
  /**
   * The server's own roll-up of `signature_valid && !revoked`, and the headline
   * status on the card. Never returned `true` alongside `revoked`.
   */
  valid: boolean;
  signature_valid: boolean;
  revoked: boolean;
  /** Returned only when the certificate is revoked. */
  revoked_at?: string;
  /** Returned only when the certificate is revoked, and only if a reason was recorded. */
  revoke_reason?: string;
  issued_at?: string;
  issuer?: string;
  signing_key_id?: string;
};

/**
 * Verifies a certificate. Public — no API key, and not rate limited, so an
 * auditor or bank can check many certificates without an account.
 *
 * The ID is sent exactly as given. Certificate IDs are a case-sensitive exact
 * match on the server, so normalising case here would turn valid IDs into 404s.
 */
export function verifyCertificate(certificateId: string): Promise<CertificateVerification> {
  return apiRequest({
    path: `/v2/certificates/${encodeURIComponent(certificateId)}/verify`,
    parseData: parseCertificateVerification,
  });
}

/**
 * Public, served as `Content-Disposition: inline` with no headers required, so
 * this URL can be handed straight to an in-app browser tab rather than being
 * downloaded first.
 */
export function buildCertificatePdfUrl(certificateId: string) {
  return `${API_BASE_URL}/v2/certificates/${encodeURIComponent(certificateId)}/pdf`;
}

function parseCertificateVerification(data: unknown): CertificateVerification {
  // Only the verdict fields are required. `issued_at` and `issuer` are display
  // detail: a certificate whose issuer name went missing is still verified, and
  // throwing here would replace a correct verdict with an error screen.
  if (
    !isObject(data) ||
    typeof data.certificate_id !== 'string' ||
    typeof data.valid !== 'boolean' ||
    typeof data.signature_valid !== 'boolean' ||
    typeof data.revoked !== 'boolean'
  ) {
    throw new Error('Certificate verification response has an unexpected shape.');
  }

  return {
    certificate_id: data.certificate_id,
    valid: data.valid,
    signature_valid: data.signature_valid,
    revoked: data.revoked,
    revoked_at: getOptionalString(data.revoked_at),
    revoke_reason: getOptionalString(data.revoke_reason),
    issued_at: getOptionalString(data.issued_at),
    issuer: parseIssuer(data.issuer),
    signing_key_id: getOptionalString(data.signing_key_id),
  };
}

/**
 * `/verify` returns the issuer as a plain name string, while the full
 * certificate payload returns an object carrying the same name under `name`.
 * Accepting either costs one branch and avoids rendering "[object Object]" if
 * the two shapes are ever brought into line.
 */
function parseIssuer(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  return isObject(value) ? getOptionalString(value.name) : undefined;
}

/**
 * The full signed payload — subject, address, device integrity and the
 * signature itself. Authenticated, deliberately: certificate IDs travel freely,
 * and gating this keeps customer IDs and declared addresses from being
 * enumerable by anyone who happens to hold one.
 */
export type CertificateSubject = {
  customer_id?: string;
  declared_address?: string;
};

export type CertificateVerificationDetail = {
  verification_id?: string;
  /** `NEAR` · `FAR` · `ADDRESS_NOT_FOUND` · `INVALID_FORMAT`. */
  result?: string;
  /**
   * Whether the device was actually at the address. Independent of whether the
   * certificate is authentic — one is issued for failed attempts too.
   */
  verified?: boolean;
  /** 0.0–1.0. */
  confidence?: number;
  device_distance_m?: number;
  gps_accuracy_m?: number;
  method?: string;
  timestamp?: string;
};

export type CertificateAddress = {
  gps_code?: string;
  region?: string;
  district?: string;
  area?: string;
  lat?: number;
  lng?: number;
  /** 0.0–1.0. */
  quality_score?: number;
};

export type CertificateIntegrity = {
  /** `LOW` · `MEDIUM` · `HIGH`. */
  spoof_risk?: string;
  /** 0.0–1.0, higher is worse. Not a percentage. */
  fraud_risk_score?: number;
  fraud_risk_level?: string;
  /** `PASS` · `MISMATCH` · `NOT_PROVIDED`. */
  ip_location_match?: string;
};

export type CertificateSignature = {
  algorithm?: string;
  kid?: string;
  signature?: string;
};

export type CertificateDetail = {
  id: string;
  version?: number;
  issued_at?: string;
  issuer_name?: string;
  verification_base_url?: string;
  subject: CertificateSubject;
  verification: CertificateVerificationDetail;
  address: CertificateAddress;
  integrity: CertificateIntegrity;
  /** A legal attestation carried by every certificate. Display verbatim. */
  disclaimer?: string;
  signature: CertificateSignature;
};

export function getCertificate(certificateId: string): Promise<CertificateDetail> {
  return apiRequest({
    path: `/v2/certificates/${encodeURIComponent(certificateId)}`,
    authenticated: true,
    parseData: parseCertificateDetail,
  });
}

/** The public web page for a certificate — what a person can actually open. */
export function buildCertificateShareUrl(certificateId: string) {
  return `${CERTIFICATE_WEB_BASE_URL}/certificate/${encodeURIComponent(certificateId)}`;
}

function parseCertificateDetail(data: unknown): CertificateDetail {
  const certificate = isObject(data) && isObject(data.certificate) ? data.certificate : undefined;

  if (!certificate || typeof certificate.id !== 'string') {
    throw new Error('Certificate payload has an unexpected shape.');
  }

  const issuer = isObject(certificate.issuer) ? certificate.issuer : {};
  const subject = isObject(certificate.subject) ? certificate.subject : {};
  const verification = isObject(certificate.verification) ? certificate.verification : {};
  const address = isObject(certificate.address) ? certificate.address : {};
  const integrity = isObject(certificate.integrity) ? certificate.integrity : {};
  const signature = isObject(data) && isObject(data.signature) ? data.signature : {};

  // Every field below the id is optional. The server marks most of them
  // omitempty, and a missing risk score should blank one row rather than fail
  // the whole screen.
  return {
    id: certificate.id,
    version: getOptionalNumber(certificate.version),
    issued_at: getOptionalString(certificate.issued_at),
    issuer_name: getOptionalString(issuer.name),
    verification_base_url: getOptionalString(issuer.verification_base_url),
    subject: {
      customer_id: getOptionalString(subject.customer_id),
      declared_address: getOptionalString(subject.declared_address),
    },
    verification: {
      verification_id: getOptionalString(verification.verification_id),
      result: getOptionalString(verification.result),
      verified: typeof verification.verified === 'boolean' ? verification.verified : undefined,
      confidence: getOptionalNumber(verification.confidence),
      device_distance_m: getOptionalNumber(verification.device_distance_m),
      gps_accuracy_m: getOptionalNumber(verification.gps_accuracy_m),
      method: getOptionalString(verification.method),
      timestamp: getOptionalString(verification.timestamp),
    },
    address: {
      gps_code: getOptionalString(address.gps_code),
      region: getOptionalString(address.region),
      district: getOptionalString(address.district),
      area: getOptionalString(address.area),
      lat: getOptionalNumber(address.lat),
      lng: getOptionalNumber(address.lng),
      quality_score: getOptionalNumber(address.quality_score),
    },
    integrity: {
      spoof_risk: getOptionalString(integrity.spoof_risk),
      fraud_risk_score: getOptionalNumber(integrity.fraud_risk_score),
      fraud_risk_level: getOptionalString(integrity.fraud_risk_level),
      ip_location_match: getOptionalString(integrity.ip_location_match),
    },
    disclaimer: getOptionalString(certificate.disclaimer),
    signature: {
      algorithm: getOptionalString(signature.algorithm),
      kid: getOptionalString(signature.kid),
      signature: getOptionalString(signature.signature),
    },
  };
}
