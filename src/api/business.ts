import { API_BASE_URL, ApiRequestError, getOptionalString, isObject } from './client';

/**
 * Business listings: submitting one that is not on the map yet
 * (`add-your-business.md`) and claiming one that already is, with a promotion
 * attached (`promotion.md`).
 *
 * Both land in a review queue — neither goes live on submission. Every response
 * here carries `status: "pending"`, and the UI says "submitted for review"
 * rather than "added" or "claimed".
 */

/**
 * `kind` is free text server-side. This list is the one the rest of the app
 * renders icons and labels for, so staying inside it keeps a submitted business
 * looking like every other landmark.
 */
export const BUSINESS_KINDS = [
  { value: 'market_stall', label: 'Market stall' },
  { value: 'shop', label: 'Shop' },
  { value: 'food_vendor', label: 'Food vendor' },
  { value: 'momo_agent', label: 'MoMo agent' },
  { value: 'fuel_station', label: 'Fuel station' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'other', label: 'Other' },
] as const;

/** The server caps this; enforced client-side so the error arrives before the request. */
export const BUSINESS_NAME_MAX_LENGTH = 120;
export const PROMOTION_TEXT_MAX_LENGTH = 280;
/** Total span allowed between a promotion's start and expiry. */
export const PROMOTION_MAX_WINDOW_DAYS = 180;

export type SubmitBusinessRequest = {
  name: string;
  kind: string;
  lat: number;
  lng: number;
  /** Used for follow-up during review only; never shown publicly. */
  phone?: string;
};

export type SubmitBusinessResult = {
  candidateId?: number;
  status: string;
};

export type ClaimBusinessRequest = {
  slug: string;
  claimantName: string;
  claimantPhone: string;
  claimantEmail?: string;
  promotionText: string;
  /** RFC3339. Omitted means the promotion starts as soon as it is approved. */
  promotionStartsAt?: string;
  /** RFC3339, required, must be in the future. */
  promotionExpiresAt: string;
};

export type ClaimBusinessResult = {
  claimId?: string;
  status: string;
  /**
   * Shown exactly once. Without it the owner cannot edit or cancel the
   * promotion without going through support.
   */
  editToken?: string;
};

export type UpdatePromotionRequest = {
  slug: string;
  editToken: string;
  /** An empty string clears the promotion entirely — there is no delete endpoint. */
  promotionText: string;
  promotionStartsAt?: string | null;
  promotionExpiresAt?: string | null;
};

/**
 * These endpoints put their payload on the top level of the envelope
 * (`{ success, candidate_id, status }`) rather than under `data`, which is what
 * `apiRequest` hands its parser. So they go through `fetch` directly and
 * validate the envelope themselves.
 */
async function postEnvelope(path: string, body: object): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });

  return readEnvelope(response);
}

async function readEnvelope(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  let parsed: unknown;

  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiRequestError({
      code: 'INVALID_RESPONSE',
      message: 'The server returned an unexpected response.',
      status: response.status,
    });
  }

  const envelope = isObject(parsed) ? parsed : {};

  if (!response.ok || envelope.success === false) {
    const error = isObject(envelope.error) ? envelope.error : {};

    throw new ApiRequestError({
      code: getOptionalString(error.code) ?? 'HTTP_ERROR',
      message: getOptionalString(error.message) ?? `Request failed with status ${response.status}`,
      status: response.status,
    });
  }

  return envelope;
}

export async function submitBusinessListing(body: SubmitBusinessRequest): Promise<SubmitBusinessResult> {
  const envelope = await postEnvelope('/v2/landmarks/submit', {
    name: body.name,
    kind: body.kind,
    lat: body.lat,
    lng: body.lng,
    ...(body.phone ? { phone: body.phone } : {}),
  });

  return {
    candidateId: typeof envelope.candidate_id === 'number' ? envelope.candidate_id : undefined,
    status: getOptionalString(envelope.status) ?? 'pending',
  };
}

export async function claimBusiness(body: ClaimBusinessRequest): Promise<ClaimBusinessResult> {
  const envelope = await postEnvelope(`/v2/landmarks/${encodeURIComponent(body.slug)}/claim`, {
    claimant_name: body.claimantName,
    claimant_phone: body.claimantPhone,
    ...(body.claimantEmail ? { claimant_email: body.claimantEmail } : {}),
    promotion_text: body.promotionText,
    ...(body.promotionStartsAt ? { promotion_starts_at: body.promotionStartsAt } : {}),
    promotion_expires_at: body.promotionExpiresAt,
  });

  return {
    claimId: getOptionalString(envelope.claim_id),
    status: getOptionalString(envelope.status) ?? 'pending',
    editToken: getOptionalString(envelope.edit_token),
  };
}

/**
 * Edits or cancels a promotion. `404` covers both a wrong token and an
 * unclaimed slug — the API does not distinguish them, so neither does the UI.
 */
export async function updatePromotion({
  slug,
  editToken,
  promotionText,
  promotionStartsAt,
  promotionExpiresAt,
}: UpdatePromotionRequest): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/v2/landmarks/${encodeURIComponent(slug)}/promotion`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Edit-Token': editToken,
    },
    body: JSON.stringify({
      promotion_text: promotionText,
      promotion_starts_at: promotionStartsAt ?? null,
      promotion_expires_at: promotionExpiresAt ?? null,
    }),
  });

  await readEnvelope(response);
}

/**
 * Client-side mirror of the server's promotion validation, so the owner is told
 * what is wrong while they are still in the form rather than after a round trip.
 * Returns `null` when the window is acceptable.
 */
export function validatePromotionWindow({
  startsAt,
  expiresAt,
}: {
  startsAt?: string;
  expiresAt: string;
}): string | null {
  const expiry = new Date(expiresAt);

  if (Number.isNaN(expiry.getTime())) {
    return 'Choose when the promotion should end.';
  }

  if (expiry.getTime() <= Date.now()) {
    return 'The end date has to be in the future.';
  }

  const start = startsAt ? new Date(startsAt) : null;

  if (start && Number.isNaN(start.getTime())) {
    return 'Choose a valid start date.';
  }

  if (start && start.getTime() >= expiry.getTime()) {
    return 'The promotion has to start before it ends.';
  }

  const windowStart = start ? start.getTime() : Date.now();
  const windowDays = (expiry.getTime() - windowStart) / 86_400_000;

  if (windowDays > PROMOTION_MAX_WINDOW_DAYS) {
    return `A promotion can run for at most ${PROMOTION_MAX_WINDOW_DAYS} days.`;
  }

  return null;
}
