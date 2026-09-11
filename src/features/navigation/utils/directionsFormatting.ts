import type {
  RouteEndpoint,
  RouteMode,
  RouteNarration,
  RoutePoint,
  RouteRequest,
} from '../../../api/route';
import type { ResolvedFindGpsResult } from '../../../utils/resolveAddressQuery';

/**
 * Every way of getting there the app offers, including transit — which is not a
 * `/v2/route` profile but belongs beside them in the UI. The screen narrows
 * back to `RouteMode` before it builds a route request.
 */
export type TravelMode = RouteMode | 'transit';

export function isRouteMode(mode: TravelMode): mode is RouteMode {
  return mode !== 'transit';
}

export const MODE_OPTIONS: ReadonlyArray<{ label: string; value: TravelMode }> = [
  { label: 'Drive', value: 'driving' },
  { label: 'Okada', value: 'motor_scooter' },
  { label: 'Trotro', value: 'transit' },
  { label: 'Walk', value: 'foot' },
  { label: 'Bike', value: 'bicycle' },
] as const;

export const NARRATION_OPTIONS: ReadonlyArray<{ label: string; value: RouteNarration }> = [
  { label: 'Street', value: 'street' },
  { label: 'Landmark', value: 'landmark' },
  { label: 'Both', value: 'both' },
] as const;

/** Short label for a resolved endpoint, mirroring FindGPS's `getSearchLabel`. */
export function getEndpointLabel(result: ResolvedFindGpsResult) {
  const shortLabel = [result.area, result.district].filter(Boolean).join(', ');

  return shortLabel || result.displayName;
}

/**
 * Whether the autocomplete dropdown is on screen.
 *
 * Shared by the overlay that renders it and the screen that has to keep map
 * chrome out from under it — two copies of this predicate drift, and the symptom
 * is a floating button sitting on top of the suggestion list.
 *
 * Once the focused field's text is exactly the label a resolution produced, the
 * dropdown would keep matching itself and never close, so it only shows while
 * the user is actively typing something new.
 */
export function isSuggestionListVisible({
  resolvedLabel,
  query,
  suggestionCount,
}: {
  resolvedLabel: string | null;
  query: string;
  suggestionCount: number;
}) {
  const trimmed = query.trim();

  return trimmed !== resolvedLabel && suggestionCount > 0 && trimmed.length >= 2;
}

export function formatDuration(seconds: number) {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

/**
 * A hex code when the user gave one, coordinates otherwise.
 *
 * `/v2/route` accepts `hex`, `point` or `gps_code`, and the hex is the more
 * faithful of the two we hold: it is what the user typed, where the point is a
 * cell centroid derived from it.
 */
function toRouteEndpoint(endpoint: ResolvedFindGpsResult): RouteEndpoint {
  if (endpoint.hexCode) {
    return { hex: endpoint.hexCode };
  }

  return { point: { lat: endpoint.latitude, lng: endpoint.longitude } };
}

type BuildRouteRequestInput = {
  from: ResolvedFindGpsResult;
  to: ResolvedFindGpsResult;
  mode: RouteMode;
  narration: RouteNarration;
  avoidFloodZones: boolean;
  avoidIncidents?: boolean;
  avoidLocations: RoutePoint[];
  /** Data saver: polyline and ETA only, no steps, landmarks or alternatives. */
  lite?: boolean;
};

/** Only includes optional fields when the user actually set them — never sends empty arrays. */
export function buildRouteRequest({
  from,
  to,
  mode,
  narration,
  avoidFloodZones,
  avoidIncidents = false,
  avoidLocations,
  lite = false,
}: BuildRouteRequestInput): RouteRequest {
  return {
    from: toRouteEndpoint(from),
    to: toRouteEndpoint(to),
    mode,
    narration,
    ...(avoidFloodZones ? { avoid_flood_zones: true } : {}),
    ...(avoidIncidents ? { avoid_incidents: true } : {}),
    ...(avoidLocations.length > 0 ? { avoid_locations: avoidLocations } : {}),
    ...(lite ? { lite: true } : {}),
  };
}
