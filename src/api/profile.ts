import { API_BASE_URL, ApiRequestError, getOptionalNumber, getOptionalString, isObject } from './client';

/**
 * The `@handle` address profile: save a location once, get a permanent link at
 * `maps.afrihex.com/{slug}` that anyone can open. No account on either side —
 * ownership is an `edit_token` handed out once at creation.
 *
 * Every response here is a **flat map** — `profile_handler.go` predates the
 * `{ success, data }` convention and returns hand-built fields at the root,
 * with no `success` key at all. The HTTP status is the only success signal.
 */

export const PROFILE_SLUG_MIN_LENGTH = 3;
export const PROFILE_SLUG_MAX_LENGTH = 30;

export type AddressProfile = {
  slug: string;
  displayName?: string;
  hexCode?: string;
  lat?: number;
  lng?: number;
  label?: string;
  notes?: string;
  viewCount?: number;
  createdAt?: string;
  /** Owner-only — present only when the request carried a valid edit token. */
  phone?: string;
  alertEmail?: string;
  floodAlertsOn?: boolean;
};

export type CreateProfileRequest = {
  slug: string;
  lat: number;
  lng: number;
  displayName?: string;
  label?: string;
  notes?: string;
  phone?: string;
  /** Stored and echoed back, never derived from lat/lng server-side. */
  hexCode?: string;
  floodAlertsOn?: boolean;
  /** Required by the API whenever `floodAlertsOn` is true. */
  alertEmail?: string;
};

export type CreateProfileResult = {
  profile: AddressProfile;
  /** Shown exactly once. Losing it means a permanently unowned profile. */
  editToken?: string;
};

/**
 * The public link.
 *
 * The `@` is part of the URL, not just display copy — the web app routes on
 * `/@{slug}` and renders its own not-found page for a bare `/{slug}`. The slug
 * itself never carries the `@`; every API call still sends it plain.
 */
export function buildProfileUrl(slug: string) {
  return `https://maps.afrihex.com/@${encodeURIComponent(slug)}`;
}

/**
 * Handles are 3–30 characters, lowercase letters, numbers and hyphens. The `@`
 * in UI copy is display convention only and is never part of the value sent.
 */
export function normalizeSlug(input: string) {
  return input.trim().toLowerCase().replace(/^@/, '');
}

export function getSlugProblem(slug: string): string | null {
  if (slug.length < PROFILE_SLUG_MIN_LENGTH || slug.length > PROFILE_SLUG_MAX_LENGTH) {
    return `Handles are ${PROFILE_SLUG_MIN_LENGTH}–${PROFILE_SLUG_MAX_LENGTH} characters.`;
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return 'Use lowercase letters, numbers and hyphens only.';
  }

  return null;
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

async function request(
  path: string,
  init: { method?: string; body?: object; editToken?: string } = {},
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (init.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (init.editToken) {
    headers['X-Edit-Token'] = init.editToken;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  return readEnvelope(response);
}

function parseProfile(data: Record<string, unknown>, fallbackSlug: string): AddressProfile {
  return {
    slug: getOptionalString(data.slug) ?? fallbackSlug,
    displayName: getOptionalString(data.display_name),
    hexCode: getOptionalString(data.hex_code),
    lat: getOptionalNumber(data.lat),
    lng: getOptionalNumber(data.lng),
    label: getOptionalString(data.label),
    notes: getOptionalString(data.notes),
    viewCount: getOptionalNumber(data.view_count),
    createdAt: getOptionalString(data.created_at),
    phone: getOptionalString(data.phone),
    alertEmail: getOptionalString(data.alert_email),
    floodAlertsOn: typeof data.flood_alerts_on === 'boolean' ? data.flood_alerts_on : undefined,
  };
}

/** Reserved names (`admin`, `api`, `support`, …) always come back unavailable. */
export async function checkSlugAvailable(slug: string): Promise<boolean> {
  const body = await request(`/v2/profile/check?slug=${encodeURIComponent(slug)}`);

  return body.available === true;
}

export async function createProfile(body: CreateProfileRequest): Promise<CreateProfileResult> {
  const created = await request('/v2/profile', {
    method: 'POST',
    body: {
      slug: body.slug,
      lat: body.lat,
      lng: body.lng,
      ...(body.displayName ? { display_name: body.displayName } : {}),
      ...(body.label ? { label: body.label } : {}),
      ...(body.notes ? { notes: body.notes } : {}),
      ...(body.phone ? { phone: body.phone } : {}),
      ...(body.hexCode ? { hex_code: body.hexCode } : {}),
      ...(body.floodAlertsOn ? { flood_alerts_on: true, alert_email: body.alertEmail } : {}),
    },
  });

  return {
    profile: parseProfile(created, body.slug),
    // Shown exactly once, here. Nothing can recover it afterwards.
    editToken: getOptionalString(created.edit_token),
  };
}

/** Sending the edit token returns the owner-only fields too, for prefilling an edit form. */
export async function getProfile(slug: string, editToken?: string): Promise<AddressProfile> {
  const body = await request(`/v2/profile/${encodeURIComponent(slug)}`, { editToken });

  return parseProfile(body, slug);
}

/**
 * Returns the full owner object, not an acknowledgement — so the caller can use
 * the result directly instead of refetching. Body fields are pointers
 * server-side: omitting one leaves it alone, sending it null overwrites it.
 */
export async function updateProfile(
  slug: string,
  editToken: string,
  changes: Partial<Omit<CreateProfileRequest, 'slug'>>,
): Promise<AddressProfile> {
  const updated = await request(`/v2/profile/${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    editToken,
    body: {
      ...(changes.lat !== undefined ? { lat: changes.lat } : {}),
      ...(changes.lng !== undefined ? { lng: changes.lng } : {}),
      ...(changes.displayName !== undefined ? { display_name: changes.displayName } : {}),
      ...(changes.label !== undefined ? { label: changes.label } : {}),
      ...(changes.notes !== undefined ? { notes: changes.notes } : {}),
      ...(changes.phone !== undefined ? { phone: changes.phone } : {}),
      ...(changes.floodAlertsOn !== undefined
        ? { flood_alerts_on: changes.floodAlertsOn, ...(changes.alertEmail ? { alert_email: changes.alertEmail } : {}) }
        : {}),
    },
  });

  return parseProfile(updated, slug);
}

/** `204 No Content` on success — there is no body to read. */
export async function deleteProfile(slug: string, editToken: string): Promise<void> {
  await request(`/v2/profile/${encodeURIComponent(slug)}`, { method: 'DELETE', editToken });
}
