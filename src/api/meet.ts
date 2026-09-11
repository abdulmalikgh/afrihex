import { API_BASE_URL, ApiRequestError, getOptionalNumber, getOptionalString, isObject } from './client';

/**
 * "Meet Me There" — ephemeral convergence sessions. A few people, or a courier
 * and a customer, share live position toward one destination until everyone
 * arrives. No account and no auth: a session is fully described by its
 * `session_id` plus `join_token`, so those two strings are the credential and
 * are treated like one.
 *
 * Sessions expire six hours after creation.
 */

export type MeetDestination = {
  hex?: string;
  lat?: number;
  lng?: number;
  label?: string;
};

export type MeetMember = {
  memberId: string;
  displayName: string;
  role?: string;
  lat?: number;
  lng?: number;
  hasArrived: boolean;
  lastSeen?: string;
};

export type MeetSession = {
  sessionId: string;
  joinToken: string;
  destination: MeetDestination;
  expiresAt?: string;
};

export type MeetStatus = {
  active: boolean;
  memberCount: number;
  arrivedCount: number;
};

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
      code: getOptionalString(error.code) ?? describeMeetStatus(response.status),
      message: getOptionalString(error.message) ?? describeMeetStatus(response.status),
      status: response.status,
    });
  }

  // Flat map: `meet_handler.go` predates the envelope convention and has no
  // `success` key at all — the HTTP status is the only signal.
  return envelope;
}

/** The three failures the meet endpoints distinguish by status code. */
function describeMeetStatus(status: number) {
  switch (status) {
    case 401:
      return 'This meetup link is not valid.';
    case 410:
      return 'This meetup has expired. Sessions last six hours.';
    case 404:
      return 'That meetup could not be found.';
    default:
      return `Request failed with status ${status}`;
  }
}

export function parseMeetDestination(value: unknown): MeetDestination {
  if (!isObject(value)) {
    return {};
  }

  return {
    hex: getOptionalString(value.hex),
    lat: getOptionalNumber(value.lat),
    lng: getOptionalNumber(value.lng),
    label: getOptionalString(value.label),
  };
}

export function parseMeetMember(value: unknown): MeetMember | null {
  if (!isObject(value)) {
    return null;
  }

  const memberId = getOptionalString(value.member_id);

  if (!memberId) {
    return null;
  }

  return {
    memberId,
    displayName: getOptionalString(value.display_name) ?? 'Someone',
    role: getOptionalString(value.role),
    lat: getOptionalNumber(value.lat),
    lng: getOptionalNumber(value.lng),
    hasArrived: value.has_arrived === true,
    lastSeen: getOptionalString(value.last_seen),
  };
}

/**
 * `dest_lat`/`dest_lng` is the normal path — wherever the destination came
 * from, a pin or a search result, coordinates are already in hand. A `hex` is
 * accepted instead when one happens to be available; nothing here converts
 * between the two.
 */
export async function createMeetSession(body: {
  destLat?: number;
  destLng?: number;
  destination?: string;
  destLabel?: string;
}): Promise<MeetSession> {
  const response = await fetch(`${API_BASE_URL}/v2/meet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      ...(body.destination
        ? { destination: body.destination }
        : { dest_lat: body.destLat, dest_lng: body.destLng }),
      ...(body.destLabel ? { dest_label: body.destLabel } : {}),
    }),
  });

  const data = await readEnvelope(response);
  const sessionId = getOptionalString(data.session_id);
  const joinToken = getOptionalString(data.join_token);

  if (!sessionId || !joinToken) {
    throw new ApiRequestError({
      code: 'INVALID_RESPONSE',
      message: 'The session could not be created.',
      status: response.status,
    });
  }

  return {
    sessionId,
    joinToken,
    destination: parseMeetDestination(data.destination),
    expiresAt: getOptionalString(data.expires_at),
  };
}

/**
 * The courier↔customer framing of the same session. It answers with two join
 * URLs rather than one token; a native client pulls `session_id` and the `t`
 * query param back out of them, which is what this does.
 */
export async function createRendezvous(body: {
  destLat: number;
  destLng: number;
  destLabel?: string;
  trackingRef?: string;
  courierName?: string;
  customerName?: string;
}): Promise<MeetSession & { courierJoinUrl?: string; customerJoinUrl?: string }> {
  const response = await fetch(`${API_BASE_URL}/v2/delivery/rendezvous`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      dest_lat: body.destLat,
      dest_lng: body.destLng,
      ...(body.destLabel ? { dest_label: body.destLabel } : {}),
      ...(body.trackingRef ? { tracking_ref: body.trackingRef } : {}),
      ...(body.courierName ? { courier_name: body.courierName } : {}),
      ...(body.customerName ? { customer_name: body.customerName } : {}),
    }),
  });

  const data = await readEnvelope(response);
  const courierJoinUrl = getOptionalString(data.courier_join_url);
  const customerJoinUrl = getOptionalString(data.customer_join_url);
  const sessionId = getOptionalString(data.session_id) ?? extractSessionId(courierJoinUrl);
  const joinToken = getOptionalString(data.join_token) ?? extractJoinToken(courierJoinUrl);

  if (!sessionId || !joinToken) {
    throw new ApiRequestError({
      code: 'INVALID_RESPONSE',
      message: 'The delivery session could not be created.',
      status: response.status,
    });
  }

  return {
    sessionId,
    joinToken,
    destination: parseMeetDestination(data.destination),
    expiresAt: getOptionalString(data.expires_at),
    courierJoinUrl,
    customerJoinUrl,
  };
}

function extractSessionId(url?: string) {
  return url?.match(/\/meet\/([^/?#]+)/)?.[1];
}

function extractJoinToken(url?: string) {
  return url?.match(/[?&]t=([^&#]+)/)?.[1];
}

/** Initial state, called once before opening the socket. */
export async function getMeetSession(
  sessionId: string,
  joinToken: string,
): Promise<{ destination: MeetDestination; members: MeetMember[] }> {
  const response = await fetch(
    `${API_BASE_URL}/v2/meet/${encodeURIComponent(sessionId)}?t=${encodeURIComponent(joinToken)}`,
    { headers: { Accept: 'application/json' } },
  );

  const data = await readEnvelope(response);
  const rawMembers = Array.isArray(data.members) ? data.members : [];

  return {
    destination: parseMeetDestination(data.destination),
    members: rawMembers.flatMap((member) => {
      const parsed = parseMeetMember(member);

      return parsed ? [parsed] : [];
    }),
  };
}

/** The lighter poll — no token needed, for a "meetup in progress" badge. */
export async function getMeetStatus(sessionId: string): Promise<MeetStatus> {
  const response = await fetch(`${API_BASE_URL}/v2/meet/${encodeURIComponent(sessionId)}/status`, {
    headers: { Accept: 'application/json' },
  });

  const data = await readEnvelope(response);

  return {
    active: data.active === true,
    memberCount: getOptionalNumber(data.member_count) ?? 0,
    arrivedCount: getOptionalNumber(data.arrived_count) ?? 0,
  };
}

export function buildMeetSocketUrl(sessionId: string, joinToken: string) {
  const base = API_BASE_URL.replace(/^http/, 'ws');

  return `${base}/v2/meet/${encodeURIComponent(sessionId)}/ws?t=${encodeURIComponent(joinToken)}`;
}

/** The shareable link, the same one the web client hands out. */
export function buildMeetJoinUrl(sessionId: string, joinToken: string) {
  return `https://maps.afrihex.com/meet/${encodeURIComponent(sessionId)}?t=${encodeURIComponent(joinToken)}`;
}
