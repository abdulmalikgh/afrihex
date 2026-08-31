import type {
  LandmarkPassed,
  RouteAlternative,
  RouteResponse,
  RouteStep,
} from '../../../api/route';

export type PlannedRoute = {
  distanceM: number;
  durationS: number;
  etaS: number;
  trafficNote: string;
  coordinates: Array<[number, number]>;
  steps: RouteStep[];
  landmarksPassed: LandmarkPassed[];
  warnings: string[];
  floodAvoidanceFailed: boolean;
  alternatives: RouteAlternative[];
  hasUnpaved: 'yes' | 'no' | 'unknown';
  unpavedDistanceM?: number;
  floodCrossings?: number;
  recommended: boolean;
  recommendReason?: string;
  raw: RouteResponse;
};

export type DirectionsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; route: PlannedRoute }
  | { status: 'noRoute'; message: string }
  | { status: 'error'; message: string };

export function toPlannedRoute(response: RouteResponse): PlannedRoute {
  return {
    distanceM: response.distance_m,
    durationS: response.duration_s,
    etaS: response.eta_s,
    trafficNote: response.traffic_note,
    coordinates: response.coordinates,
    steps: response.steps,
    landmarksPassed: response.landmarks_passed,
    warnings: response.warnings ?? [],
    floodAvoidanceFailed: response.flood_avoidance_failed ?? false,
    alternatives: response.alternatives ?? [],
    hasUnpaved: response.has_unpaved === undefined ? 'unknown' : response.has_unpaved ? 'yes' : 'no',
    unpavedDistanceM: response.unpaved_distance_m,
    floodCrossings: response.flood_crossings,
    recommended: response.recommended ?? false,
    recommendReason: response.recommend_reason,
    raw: response,
  };
}
