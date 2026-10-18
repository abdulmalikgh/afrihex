import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

import { reportArrival } from '../../../api/navigation';
import type { RouteMode, RoutePoint } from '../../../api/route';
import { ARRIVAL_RADIUS_M } from '../utils/turnGuidance';
import { distanceMeters } from '../utils/geo';

/**
 * Background location for an in-progress trip.
 *
 * ## What this actually buys
 *
 * The honest scope is narrower than "navigation keeps working in the background":
 *
 * - **It does** keep the trip tracked, and report the arrival, while the screen
 *   is locked or the user has switched away — which is when the arrival is most
 *   worth recording, since they are driving and cannot tap "I'm here".
 * - **It does not** speak. `expo-speech` in a headless task has no audio session
 *   on iOS, and an iOS background task that tried to make sound would be killed
 *   or silently dropped. Voice stays foreground-only, where the guidance HUD is
 *   also on screen.
 *
 * ## Why arrival lives here rather than in the hook
 *
 * `useArrivalReport` already runs a foreground watch that reports arrival, and
 * two reporters for one trip means two telemetry records for one journey — which
 * is worse than no record at all, because it double-counts the sample that trains
 * the traffic estimates.
 *
 * So the two are mutually exclusive by construction: while this task is
 * registered, the foreground watch stands down. `useTurnByTurn` owns that
 * decision, and only one of the two ever holds the destination.
 *
 * ## The cold-launch limitation
 *
 * Expo documents that background location "will stop if the user terminates the
 * app", and that Android will not restart a terminated app for a location event.
 * When the OS relaunches the bundle purely to run this task, the module-level
 * trip below is empty — a fresh JS context has no memory of the journey. Rather
 * than guess at a destination it does not have, it exits. That is a platform
 * limit, not a gap to paper over, and reporting a fabricated arrival would be
 * worse than reporting nothing.
 */
export const NAVIGATION_LOCATION_TASK = 'afrihex-navigation-location';

type ActiveTrip = {
  origin: RoutePoint | null;
  destination: RoutePoint;
  mode: RouteMode;
  routeDistanceM: number;
  routeDurationS: number;
  startedAt: number;
  hasReported: boolean;
};

/**
 * Module scope on purpose: `defineTask` must be called at the top level of the
 * bundle, and the task body needs this state to have any idea what trip it is
 * part of.
 */
let activeTrip: ActiveTrip | null = null;

export function setActiveTrip(trip: ActiveTrip | null) {
  activeTrip = trip;
}

export function isNavigationTaskRunning() {
  return activeTrip !== null;
}

/**
 * `async` rather than a bare callback because the task executor is typed as
 * returning a Promise, and an early `return;` inside a synchronous function is
 * `void`. Every return below is a real exit path, and the ones that matter all
 * fall through to the same `return;` at the end.
 */
TaskManager.defineTask(NAVIGATION_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    return;
  }

  const trip = activeTrip;

  if (!trip || trip.hasReported) {
    return;
  }

  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;

  if (!locations || locations.length === 0) {
    return;
  }

  // The array is in chronological order, so the last entry is the newest fix.
  const latest = locations[locations.length - 1];
  const position = { lat: latest.coords.latitude, lng: latest.coords.longitude };

  if (distanceMeters(position, trip.destination) > ARRIVAL_RADIUS_M) {
    return;
  }

  // Latched before the request so a second fix arriving while this one is still
  // in flight cannot produce a second report.
  trip.hasReported = true;

  void reportArrival({
    destLat: trip.destination.lat,
    destLng: trip.destination.lng,
    finalLat: position.lat,
    finalLng: position.lng,
    ...(trip.origin ? { originLat: trip.origin.lat, originLng: trip.origin.lng } : {}),
    profile: trip.mode,
    routeDistanceM: trip.routeDistanceM,
    routeDurationS: trip.routeDurationS,
    achievedDurationS: Math.round((Date.now() - trip.startedAt) / 1000),
    arrived: true,
  });
});
