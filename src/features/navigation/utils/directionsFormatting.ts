import type { RouteMode, RoutePoint, RouteNarration, RouteRequest } from '../../../api/route';
import type { ResolvedFindGpsResult } from '../../../utils/resolveAddressQuery';

export const MODE_OPTIONS: ReadonlyArray<{ label: string; value: RouteMode }> = [
  { label: 'Drive', value: 'driving' },
  { label: 'Okada', value: 'motor_scooter' },
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

export function formatDuration(seconds: number) {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

type BuildRouteRequestInput = {
  from: ResolvedFindGpsResult;
  to: ResolvedFindGpsResult;
  mode: RouteMode;
  narration: RouteNarration;
  avoidFloodZones: boolean;
  avoidLocations: RoutePoint[];
};

/** Only includes optional fields when the user actually set them — never sends empty arrays. */
export function buildRouteRequest({
  from,
  to,
  mode,
  narration,
  avoidFloodZones,
  avoidLocations,
}: BuildRouteRequestInput): RouteRequest {
  return {
    from: { point: { lat: from.latitude, lng: from.longitude } },
    to: { point: { lat: to.latitude, lng: to.longitude } },
    mode,
    narration,
    ...(avoidFloodZones ? { avoid_flood_zones: true } : {}),
    ...(avoidLocations.length > 0 ? { avoid_locations: avoidLocations } : {}),
  };
}
