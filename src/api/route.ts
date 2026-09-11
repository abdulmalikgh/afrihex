import { apiRequest, getNumber, getOptionalNumber, getOptionalString, isObject } from './client';

export type RoutePoint = { lat: number; lng: number };

export type RouteEndpoint = { point: RoutePoint } | { hex: string } | { gps_code: string };

/** `okada` is a server-side alias for `motor_scooter`; the app sends the canonical name. */
export type RouteMode = 'driving' | 'foot' | 'bicycle' | 'motor_scooter' | 'truck';

export type RouteNarration = 'landmark' | 'street' | 'both';

export type RouteRequest = {
  from: RouteEndpoint;
  to: RouteEndpoint;
  mode?: RouteMode;
  narration?: RouteNarration;
  language?: string;
  avoid_locations?: RoutePoint[];
  avoid_polygons?: Array<Array<[number, number]>>;
  avoid_flood_zones?: boolean;
  /**
   * Light rerouting around corroborated (`report_count >= 2`) flooding and
   * road-blocked reports. Accident and police reports, and any single
   * uncorroborated report, stay warn-only whatever this is set to.
   */
  avoid_incidents?: boolean;
  lite?: boolean;
};

/**
 * Per-lane turn guidance, passed through from Valhalla's `turn:lanes` OSM tag.
 *
 * Genuinely rare — most Ghana roads carry no lane tagging — so it is optional
 * per *step*, not per route. A turn instruction must render with or without it.
 */
export type RouteLane = {
  indications: string[];
  /** This lane is one the driver should be in for the upcoming manoeuvre. */
  active: boolean;
  valid: boolean;
};

export type RouteStep = {
  instruction: string;
  verbal_instruction?: string;
  verbal_post?: string;
  verbal_alert?: string;
  instruction_landmark?: string;
  near_landmark?: string;
  distance_m: number;
  duration_s: number;
  coordinates: Array<[number, number]>;
  surface?: string;
  surface_color?: string;
  bearing_before?: number;
  bearing_after?: number;
  turn_angle?: number;
  turn_class?: string;
  traffic_factor?: number;
  traffic_severity?: string;
  traffic_color?: string;
  lanes?: RouteLane[];
};

export type LandmarkPassed = {
  slug: string;
  name: string;
  side?: string;
  at_step: number;
  /**
   * An active promotion on a claimed business, carried beside the name rather
   * than baked into the narration string — so the caller decides whether and
   * when to speak it. Empty outside the promotion's active window.
   */
  promotion_text?: string;
  /** Absent on responses that do not carry a position for the landmark. */
  centroid?: { lng: number; lat: number };
};

export type RouteAlternative = {
  distance_m: number;
  duration_s: number;
  eta_s: number;
  coordinates: Array<[number, number]>;
  recommended?: boolean;
  recommend_reason?: string;
  rain_note?: string;
  rain_eta_penalty_s?: number;
  flood_crossings?: number;
  has_unpaved?: boolean;
  unpaved_distance_m?: number;
};

export type RouteResponse = {
  distance_m: number;
  duration_s: number;
  eta_s: number;
  traffic_note: string;
  coordinates: Array<[number, number]>;
  steps: RouteStep[];
  landmarks_passed: LandmarkPassed[];
  has_highway?: boolean;
  warnings?: string[];
  flood_avoidance_failed?: boolean;
  alternatives?: RouteAlternative[];
  recommended?: boolean;
  recommend_reason?: string;
  rain_note?: string;
  rain_eta_penalty_s?: number;
  flood_crossings?: number;
  has_unpaved?: boolean;
  unpaved_distance_m?: number;
  /** Crowdsourced hazard reports near the route; folded into `warnings` too. */
  incident_count?: number;
};

/**
 * Plans a route. Anonymous callers hit `/route/public`; signed-in callers hit `/route`
 * for the metered/authenticated quota. Both endpoints share the same handler, response
 * type, and envelope (confirmed with backend) — one parser covers both.
 */
export function planRoute(body: RouteRequest, isAuthenticated: boolean): Promise<RouteResponse> {
  return apiRequest({
    path: isAuthenticated ? '/v2/route' : '/v2/route/public',
    method: 'POST',
    authenticated: isAuthenticated,
    body,
    parseData: parseRouteResponse,
  });
}

function parseRouteResponse(data: unknown): RouteResponse {
  if (
    !isObject(data) ||
    typeof data.distance_m !== 'number' ||
    typeof data.duration_s !== 'number' ||
    typeof data.eta_s !== 'number' ||
    typeof data.traffic_note !== 'string' ||
    !Array.isArray(data.coordinates) ||
    !Array.isArray(data.steps) ||
    !Array.isArray(data.landmarks_passed)
  ) {
    throw new Error('Route response has an unexpected shape.');
  }

  return {
    distance_m: data.distance_m,
    duration_s: data.duration_s,
    eta_s: data.eta_s,
    traffic_note: data.traffic_note,
    coordinates: data.coordinates.map(parseLngLat),
    steps: data.steps.map(parseRouteStep),
    landmarks_passed: data.landmarks_passed.map(parseLandmarkPassed),
    has_highway: typeof data.has_highway === 'boolean' ? data.has_highway : undefined,
    warnings: Array.isArray(data.warnings) ? data.warnings.filter(isNonEmptyString) : undefined,
    flood_avoidance_failed:
      typeof data.flood_avoidance_failed === 'boolean' ? data.flood_avoidance_failed : undefined,
    alternatives: Array.isArray(data.alternatives)
      ? data.alternatives.map(parseRouteAlternative)
      : undefined,
    recommended: typeof data.recommended === 'boolean' ? data.recommended : undefined,
    recommend_reason: getOptionalString(data.recommend_reason),
    rain_note: getOptionalString(data.rain_note),
    rain_eta_penalty_s: getOptionalNumber(data.rain_eta_penalty_s),
    flood_crossings: getOptionalNumber(data.flood_crossings),
    has_unpaved: typeof data.has_unpaved === 'boolean' ? data.has_unpaved : undefined,
    unpaved_distance_m: getOptionalNumber(data.unpaved_distance_m),
    incident_count: getOptionalNumber(data.incident_count),
  };
}

function parseRouteStep(data: unknown): RouteStep {
  if (
    !isObject(data) ||
    typeof data.instruction !== 'string' ||
    typeof data.distance_m !== 'number' ||
    typeof data.duration_s !== 'number' ||
    !Array.isArray(data.coordinates)
  ) {
    throw new Error('Route step has an unexpected shape.');
  }

  return {
    instruction: data.instruction,
    verbal_instruction: getOptionalString(data.verbal_instruction),
    verbal_post: getOptionalString(data.verbal_post),
    verbal_alert: getOptionalString(data.verbal_alert),
    instruction_landmark: getOptionalString(data.instruction_landmark),
    near_landmark: getOptionalString(data.near_landmark),
    distance_m: data.distance_m,
    duration_s: data.duration_s,
    coordinates: data.coordinates.map(parseLngLat),
    surface: getOptionalString(data.surface),
    surface_color: getOptionalString(data.surface_color),
    bearing_before: getOptionalNumber(data.bearing_before),
    bearing_after: getOptionalNumber(data.bearing_after),
    turn_angle: getOptionalNumber(data.turn_angle),
    turn_class: getOptionalString(data.turn_class),
    traffic_factor: getOptionalNumber(data.traffic_factor),
    traffic_severity: getOptionalString(data.traffic_severity),
    traffic_color: getOptionalString(data.traffic_color),
    lanes: parseLanes(data.lanes),
  };
}

/**
 * `mobile-api.md` documents this entry without a `centroid`; the captured payload
 * has one. Since a landmark is decoration on the route, the safe reading is to
 * accept it either way — a missing centroid costs one map dot, where throwing
 * would cost the entire route.
 */
function parseLanes(value: unknown): RouteLane[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const lanes = value.flatMap((lane) => {
    if (!isObject(lane) || !Array.isArray(lane.indications)) {
      return [];
    }

    return [
      {
        indications: lane.indications.filter((item): item is string => typeof item === 'string'),
        active: lane.active === true,
        valid: lane.valid !== false,
      },
    ];
  });

  return lanes.length > 0 ? lanes : undefined;
}

function parseLandmarkPassed(data: unknown): LandmarkPassed {
  if (!isObject(data) || typeof data.slug !== 'string' || typeof data.name !== 'string') {
    throw new Error('Landmark passed has an unexpected shape.');
  }

  const centroid = isObject(data.centroid) ? data.centroid : undefined;

  return {
    slug: data.slug,
    name: data.name,
    side: getOptionalString(data.side),
    at_step: getNumber(data.at_step, 0),
    promotion_text: getOptionalString(data.promotion_text),
    ...(typeof centroid?.lng === 'number' && typeof centroid.lat === 'number'
      ? { centroid: { lng: centroid.lng, lat: centroid.lat } }
      : {}),
  };
}

function parseRouteAlternative(data: unknown): RouteAlternative {
  if (
    !isObject(data) ||
    typeof data.distance_m !== 'number' ||
    typeof data.duration_s !== 'number' ||
    typeof data.eta_s !== 'number' ||
    !Array.isArray(data.coordinates)
  ) {
    throw new Error('Route alternative has an unexpected shape.');
  }

  return {
    distance_m: data.distance_m,
    duration_s: data.duration_s,
    eta_s: data.eta_s,
    coordinates: data.coordinates.map(parseLngLat),
    recommended: typeof data.recommended === 'boolean' ? data.recommended : undefined,
    recommend_reason: getOptionalString(data.recommend_reason),
    rain_note: getOptionalString(data.rain_note),
    rain_eta_penalty_s: getOptionalNumber(data.rain_eta_penalty_s),
    flood_crossings: getOptionalNumber(data.flood_crossings),
    has_unpaved: typeof data.has_unpaved === 'boolean' ? data.has_unpaved : undefined,
    unpaved_distance_m: getOptionalNumber(data.unpaved_distance_m),
  };
}

function parseLngLat(value: unknown): [number, number] {
  if (!Array.isArray(value) || typeof value[0] !== 'number' || typeof value[1] !== 'number') {
    throw new Error('Coordinate pair has an unexpected shape.');
  }

  return [value[0], value[1]];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
