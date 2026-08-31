import { apiRequest, getOptionalNumber, getOptionalString, isObject } from './client';

/**
 * `POST /v2/kyc/verify` accepts four input methods because the API serves
 * several clients. Mobile builds exactly two — a GPS-code field and a "Use my
 * location" button — so `hex_code` and `manual` are deliberately absent from
 * this union rather than merely unused.
 */
export type KycVerificationRequest =
  | { customer_id: string; method: 'gps_code'; location: { gps_code: string } }
  | { customer_id: string; method: 'gps_fix'; location: { lat: number; lng: number } };

/** The links the server hands back for the certificate it just issued. */
export type KycCertificateRef = {
  id: string;
  verification_url?: string;
  json_url?: string;
  pdf_url?: string;
  issued_at?: string;
};

export type KycVerificationResult = {
  verification_id?: string;
  /**
   * Whether the device was actually at the address — the only field that
   * answers "did this pass". Optional because the exact path is not yet
   * confirmed against a captured response; the UI says so rather than
   * guessing a verdict when it is missing.
   */
  verified?: boolean;
  /** `NEAR` · `FAR` · `ADDRESS_NOT_FOUND` · `INVALID_FORMAT`. */
  result?: string;
  /** 0.0–1.0. */
  confidence?: number;
  hex_code?: string;
  ghanapost_code?: string;
  /** 0.0–1.0. */
  quality_score?: number;
  region?: string;
  district?: string;
  area?: string;
  device_distance_m?: number;
  gps_accuracy_m?: number;
  spoof_risk?: string;
  /**
   * `omitempty` on the wire. Absence is normal, not an error: signing may not
   * be configured, or issuance may have failed while the verification itself
   * succeeded.
   */
  certificate?: KycCertificateRef;
};

export function verifyAddress(body: KycVerificationRequest): Promise<KycVerificationResult> {
  return apiRequest({
    path: '/v2/kyc/verify',
    method: 'POST',
    authenticated: true,
    body,
    parseData: parseKycVerificationResult,
  });
}

/**
 * Reads each field from the path `verify.md` documents, falling back to the
 * path the web widget's event payload uses. The two disagree — the guide says
 * `data.address.region` and `data.hex_code`, the widget shows `declared_address`
 * and `proximity.device_distance_m` — and we have no captured response to
 * settle it. Checking both costs one `??` per field and cannot produce a wrong
 * value: a field the server does not send stays undefined, and the UI omits
 * that row rather than inventing it.
 */
function parseKycVerificationResult(data: unknown): KycVerificationResult {
  if (!isObject(data)) {
    throw new Error('Address verification response has an unexpected shape.');
  }

  const verification = isObject(data.verification) ? data.verification : {};
  const proximity = isObject(data.proximity) ? data.proximity : {};
  const address = isObject(data.address)
    ? data.address
    : isObject(data.declared_address)
      ? data.declared_address
      : {};

  return {
    verification_id: getOptionalString(data.verification_id ?? verification.verification_id),
    verified: readOptionalBoolean(data.verified ?? verification.verified),
    result: getOptionalString(data.result ?? verification.result),
    confidence: getOptionalNumber(verification.confidence ?? data.confidence),
    hex_code: getOptionalString(data.hex_code ?? address.hex_code),
    ghanapost_code: getOptionalString(data.ghanapost_code ?? address.gps_code),
    quality_score: getOptionalNumber(data.quality_score ?? address.quality_score),
    region: getOptionalString(address.region),
    district: getOptionalString(address.district),
    area: getOptionalString(address.area),
    device_distance_m: getOptionalNumber(
      verification.device_distance_m ?? proximity.device_distance_m,
    ),
    gps_accuracy_m: getOptionalNumber(verification.gps_accuracy_m ?? proximity.gps_accuracy_m),
    spoof_risk: getOptionalString(
      isObject(data.integrity) ? data.integrity.spoof_risk : data.spoof_risk,
    ),
    certificate: parseCertificateRef(data.certificate),
  };
}

function parseCertificateRef(value: unknown): KycCertificateRef | undefined {
  if (!isObject(value) || typeof value.id !== 'string') {
    return undefined;
  }

  return {
    id: value.id,
    verification_url: getOptionalString(value.verification_url),
    json_url: getOptionalString(value.json_url),
    pdf_url: getOptionalString(value.pdf_url),
    issued_at: getOptionalString(value.issued_at),
  };
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}
