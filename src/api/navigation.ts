import {
  API_BASE_URL,
  ApiRequestError,
  apiRequest,
  buildApiPath,
  getNumber,
  getOptionalNumber,
  getOptionalString,
  isObject,
} from './client';
import type { RouteMode, RoutePoint } from './route';

/**
 * The map-layer endpoints are the one family that does **not** use the
 * `{ success, data }` envelope — they return a bare GeoJSON `FeatureCollection`,
 * always 200, `Content-Type: application/json`. So they cannot go through
 * `apiRequest`, which reads `data` off a success body that never arrives.
 */
async function fetchGeoJsonFeatures(path: string): Promise<unknown[]> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Map layer request failed with status ${response.status}`);
  }

  const body: unknown = await response.json();

  return isObject(body) && Array.isArray(body.features) ? body.features : [];
}

/** A single exterior ring, already in the `{ latitude, longitude }` order maps want. */
export type MapRing = Array<{ latitude: number; longitude: number }>;

export type FloodZone = {
  id: string;
  name: string;
  /** `low | medium | high` with `?scope=all`; the default response hardcodes `high`. */
  severity: string;
  status: string;
  rings: MapRing[];
};

export type WeatherAlert = {
  id: string;
  event: string;
  severity: string;
  headline?: string;
  instruction?: string;
  areas: string[];
  expiresAt?: string;
  rings: MapRing[];
};

export type PrecipitationPoint = {
  id: string;
  name: string;
  /** Percent, 0–100. */
  probability: number;
  amountMm: number;
  latitude: number;
  longitude: number;
};

/**
 * Flattens Polygon and MultiPolygon into a flat list of exterior rings.
 *
 * Interior rings (holes) are dropped: the overlays are read as "roughly here be
 * floods", and a doughnut hole in a flood zone changes nothing a rider would do
 * differently. Carrying them would mean threading `holes` through every caller.
 */
function toRings(geometry: unknown): MapRing[] {
  if (!isObject(geometry) || !Array.isArray(geometry.coordinates)) {
    return [];
  }

  const polygons =
    geometry.type === 'MultiPolygon'
      ? geometry.coordinates
      : geometry.type === 'Polygon'
        ? [geometry.coordinates]
        : [];

  return polygons
    .map((polygon) => (Array.isArray(polygon) ? toRing(polygon[0]) : []))
    // Two points cannot enclose an area, and react-native-maps renders the
    // degenerate case as a stray line across the map.
    .filter((ring) => ring.length >= 3);
}

function toRing(coordinates: unknown): MapRing {
  if (!Array.isArray(coordinates)) {
    return [];
  }

  return coordinates.flatMap((pair) =>
    Array.isArray(pair) && typeof pair[0] === 'number' && typeof pair[1] === 'number'
      ? [{ latitude: pair[1], longitude: pair[0] }]
      : [],
  );
}

/** Flood-prone zones. `scope=all` swaps the hardcoded `high`/`active` for real DB values. */
export async function getFloodZones(): Promise<FloodZone[]> {
  const features = await fetchGeoJsonFeatures(buildApiPath('/v2/route/flood-zones', { scope: 'all' }));

  return features.flatMap((feature, index) => {
    if (!isObject(feature)) {
      return [];
    }

    const properties = isObject(feature.properties) ? feature.properties : {};
    const rings = toRings(feature.geometry);

    if (rings.length === 0) {
      return [];
    }

    return [
      {
        // No `id` on the wire — it is admin-only — so the index stands in as a key.
        id: `flood-${index}`,
        name: getOptionalString(properties.name) ?? 'Flood-prone area',
        severity: getOptionalString(properties.severity) ?? 'high',
        status: getOptionalString(properties.status) ?? 'active',
        rings,
      },
    ];
  });
}

/** Official GMet alerts. `areas` can be `null` on the wire. */
export async function getWeatherAlerts(): Promise<WeatherAlert[]> {
  const features = await fetchGeoJsonFeatures('/v2/weather/alerts');

  return features.flatMap((feature, index) => {
    if (!isObject(feature)) {
      return [];
    }

    const properties = isObject(feature.properties) ? feature.properties : {};
    const rings = toRings(feature.geometry);

    if (rings.length === 0) {
      return [];
    }

    return [
      {
        id: `alert-${index}`,
        event: getOptionalString(properties.event) ?? 'Weather alert',
        severity: getOptionalString(properties.severity) ?? 'Unknown',
        headline: getOptionalString(properties.headline),
        instruction: getOptionalString(properties.instruction),
        areas: Array.isArray(properties.areas)
          ? properties.areas.filter((area): area is string => typeof area === 'string')
          : [],
        expiresAt: getOptionalString(properties.expires_at),
        rings,
      },
    ];
  });
}

/** Next-6h rain, as a ~165-point grid ordered by probability descending. */
export async function getPrecipitationForecast(): Promise<PrecipitationPoint[]> {
  const features = await fetchGeoJsonFeatures('/v2/precipitation-forecast');

  return features.flatMap((feature, index) => {
    if (!isObject(feature) || !isObject(feature.geometry)) {
      return [];
    }

    const coordinates = feature.geometry.coordinates;

    if (!Array.isArray(coordinates) || typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number') {
      return [];
    }

    const properties = isObject(feature.properties) ? feature.properties : {};

    return [
      {
        id: `rain-${index}`,
        name: getOptionalString(properties.name) ?? 'Rain',
        probability: getNumber(properties.probability, 0),
        amountMm: getNumber(properties.amount_mm, 0),
        latitude: coordinates[1],
        longitude: coordinates[0],
      },
    ];
  });
}

export type RouteLandmark = {
  id: number;
  slug: string;
  name: string;
  kind: string;
  latitude: number;
  longitude: number;
  distanceM?: number;
};

/**
 * Landmarks within `bufferM` of the route line. Authenticated; the doc marks it
 * optional, so callers treat a failure as "no landmarks", never as a route error.
 */
export function getLandmarksAlongRoute({
  coordinates,
  kinds,
  bufferM = 200,
}: {
  coordinates: Array<[number, number]>;
  kinds?: string[];
  bufferM?: number;
}): Promise<RouteLandmark[]> {
  return apiRequest({
    path: '/v2/route/along',
    method: 'POST',
    authenticated: true,
    body: {
      coordinates,
      ...(kinds && kinds.length > 0 ? { kinds } : {}),
      buffer_m: bufferM,
    },
    parseData: (data) => {
      if (!isObject(data) || !Array.isArray(data.landmarks)) {
        return [];
      }

      return data.landmarks.flatMap((landmark) => {
        if (!isObject(landmark) || !isObject(landmark.centroid)) {
          return [];
        }

        const { lat, lng } = landmark.centroid;

        if (typeof lat !== 'number' || typeof lng !== 'number') {
          return [];
        }

        return [
          {
            id: getNumber(landmark.id, 0),
            slug: getOptionalString(landmark.slug) ?? String(landmark.id),
            name: getOptionalString(landmark.name) ?? 'Landmark',
            kind: getOptionalString(landmark.kind) ?? 'landmark',
            latitude: lat,
            longitude: lng,
            distanceM: getOptionalNumber(landmark.distance_m),
          },
        ];
      });
    },
  });
}

/**
 * The shareable route image: a fixed 800×500 PNG, public, cached an hour.
 * `width`/`height` are not accepted — the size is fixed server-side.
 */
export function buildStaticRouteMapUrl({
  from,
  to,
  mode,
}: {
  from: RoutePoint;
  to: RoutePoint;
  mode: RouteMode;
}) {
  const path = buildApiPath('/v2/route/static', {
    from: `${from.lat},${from.lng}`,
    to: `${to.lat},${to.lng}`,
    mode,
  });

  return `${API_BASE_URL}${path}`;
}

export type ArrivalTelemetry = {
  destLat: number;
  destLng: number;
  /**
   * Where the device actually ended up. Omitted when no fix is available — the
   * server drops missing coordinates and still records the arrival, which is a
   * truer data point than the destination pin echoed back at it.
   */
  finalLat?: number;
  finalLng?: number;
  originLat?: number;
  originLng?: number;
  /** `driving | foot | bicycle`; anything else normalizes to `driving` server-side. */
  profile: string;
  routeDistanceM?: number;
  routeDurationS?: number;
  /** Preferred over start/end timestamps when we have it. */
  achievedDurationS?: number;
  /** `false` means the user gave up; omitting it defaults to `true` server-side. */
  arrived: boolean;
};

/**
 * Reports where the user actually ended up versus the pin, which is what trains
 * the traffic estimates.
 *
 * Deliberately swallows every failure: the endpoint is public, returns `204` with
 * no body, and silently drops bad fields rather than 400ing. Nothing the user
 * asked for depends on it, so a dead network or a `503 SERVER_BUSY` must not
 * surface as an error on a screen showing a perfectly good route.
 */
export async function reportArrival(telemetry: ArrivalTelemetry): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/v2/navigation/arrival`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dest_lat: telemetry.destLat,
        dest_lng: telemetry.destLng,
        profile: telemetry.profile,
        arrived: telemetry.arrived,
        ...(telemetry.finalLat !== undefined ? { final_lat: telemetry.finalLat } : {}),
        ...(telemetry.finalLng !== undefined ? { final_lng: telemetry.finalLng } : {}),
        ...(telemetry.originLat !== undefined ? { origin_lat: telemetry.originLat } : {}),
        ...(telemetry.originLng !== undefined ? { origin_lng: telemetry.originLng } : {}),
        ...(telemetry.routeDistanceM !== undefined ? { route_distance_m: telemetry.routeDistanceM } : {}),
        ...(telemetry.routeDurationS !== undefined ? { route_duration_s: telemetry.routeDurationS } : {}),
        ...(telemetry.achievedDurationS !== undefined
          ? { achieved_duration_s: telemetry.achievedDurationS }
          : {}),
      }),
    });
  } catch {
    // Intentionally silent — see the note above.
  }
}

/** Crowdsourced hazard kinds. Each has its own TTL server-side. */
export const INCIDENT_KINDS = [
  { value: 'accident', label: 'Accident' },
  { value: 'flooding', label: 'Flooding' },
  { value: 'road_blocked', label: 'Road blocked' },
  { value: 'police', label: 'Police' },
  { value: 'smoke', label: 'Smoke' },
] as const;

export type IncidentKind = (typeof INCIDENT_KINDS)[number]['value'];

export type RoadIncident = {
  id: string;
  kind: string;
  reportCount: number;
  expiresAt?: string;
  hasPhoto: boolean;
  latitude: number;
  longitude: number;
};

/**
 * Active hazard reports as a map layer.
 *
 * Bare GeoJSON with no envelope and no `success` field — this is a passthrough,
 * not an API response in the usual sense. Cached 30s server-side, and TTLs are
 * per kind (accident 2h, flooding 24h, road_blocked 6h, police 3h), so it is
 * polled rather than held.
 */
export async function getRoadIncidents(): Promise<RoadIncident[]> {
  const features = await fetchGeoJsonFeatures('/v2/route/incidents');

  return features.flatMap((feature, index) => {
    if (!isObject(feature) || !isObject(feature.geometry)) {
      return [];
    }

    const coordinates = feature.geometry.coordinates;

    if (!Array.isArray(coordinates) || typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number') {
      return [];
    }

    const properties = isObject(feature.properties) ? feature.properties : {};

    return [
      {
        id: getOptionalString(properties.id) ?? `incident-${index}`,
        kind: getOptionalString(properties.kind) ?? 'accident',
        reportCount: getNumber(properties.report_count, 1),
        expiresAt: getOptionalString(properties.expires_at),
        hasPhoto: properties.has_photo === true,
        latitude: coordinates[1],
        longitude: coordinates[0],
      },
    ];
  });
}

export type ReportIncidentResult = {
  incidentId?: string;
  kind: string;
  /** Greater than 1 means this reinforced an existing report rather than creating one. */
  reportCount: number;
  expiresAt?: string;
};

/**
 * Files a hazard report. Public, rate limited to 15/hour per IP.
 *
 * A report within ~150 m of an active report of the same kind reinforces that
 * one instead of creating a duplicate — which is why the create response
 * carries a count that can already be above one. The caller reads it to say
 * "thanks, that's confirmed" rather than "report filed".
 *
 * Flat response with a `success` key; `201` on success.
 */
export async function reportRoadIncident({
  kind,
  lat,
  lng,
  note,
}: {
  kind: IncidentKind;
  lat: number;
  lng: number;
  note?: string;
}): Promise<ReportIncidentResult> {
  const response = await fetch(`${API_BASE_URL}/v2/route/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ kind, lat, lng, ...(note ? { note } : {}) }),
  });

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

  const body = isObject(parsed) ? parsed : {};

  if (!response.ok || body.success === false) {
    const error = isObject(body.error) ? body.error : {};

    throw new ApiRequestError({
      code: getOptionalString(error.code) ?? 'HTTP_ERROR',
      message:
        getOptionalString(error.message) ??
        (response.status === 429
          ? 'You have reported a few already. Try again a bit later.'
          : `Request failed with status ${response.status}`),
      status: response.status,
    });
  }

  return {
    incidentId: getOptionalString(body.incident_id),
    kind: getOptionalString(body.kind) ?? kind,
    reportCount: getNumber(body.report_count, 1),
    expiresAt: getOptionalString(body.expires_at),
  };
}
