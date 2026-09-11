import { colors } from '../../../constants/colors';

/**
 * Fills and strokes for the map overlay layers.
 *
 * These are deliberately not `mapColors` roles. Those tokens describe chrome —
 * surfaces, text, outlines — and are tuned for contrast against each other. An
 * overlay is a translucent wash over live map tiles, so it is tuned for a
 * different job: readable at 20% opacity over both a dark park and a lit road,
 * without hiding the route line underneath it.
 */

type OverlayStyle = { fill: string; stroke: string };

/** Flood severity, from `?scope=all` — `low | medium | high`. */
export function getFloodZoneStyle(severity: string): OverlayStyle {
  switch (severity.toLowerCase()) {
    case 'low':
      return { fill: 'rgba(234, 181, 53, 0.14)', stroke: 'rgba(234, 181, 53, 0.55)' };
    case 'medium':
      return { fill: 'rgba(224, 140, 60, 0.18)', stroke: 'rgba(224, 140, 60, 0.65)' };
    default:
      return { fill: 'rgba(224, 113, 96, 0.22)', stroke: 'rgba(224, 113, 96, 0.75)' };
  }
}

/** GMet alert severity — CAP values (`Minor | Moderate | Severe | Extreme`). */
export function getWeatherAlertStyle(severity: string): OverlayStyle {
  switch (severity.toLowerCase()) {
    case 'extreme':
    case 'severe':
      return { fill: 'rgba(224, 113, 96, 0.18)', stroke: 'rgba(224, 113, 96, 0.7)' };
    default:
      return { fill: 'rgba(234, 181, 53, 0.14)', stroke: 'rgba(234, 181, 53, 0.6)' };
  }
}

/**
 * Rain arrives as a 0.5° point grid — roughly 55 km between samples — so each
 * point stands for a wide area rather than a spot. The radius scales with
 * probability so a near-certain band reads heavier than a passing chance.
 */
export function getPrecipitationCircle(probability: number) {
  const clamped = Math.max(0, Math.min(100, probability));

  return {
    radiusM: 9_000 + (clamped / 100) * 12_000,
    fill: `rgba(92, 156, 214, ${0.08 + (clamped / 100) * 0.16})`,
    stroke: 'rgba(92, 156, 214, 0.45)',
  };
}

/** An alternative the user has not selected: present, but never competing with the active line. */
export const INACTIVE_ROUTE_STROKE = colors.faint;

/**
 * Hazard-report pins. Corroborated reports (`report_count >= 2`) are the only
 * ones the router will steer around, so they read heavier than a single
 * unconfirmed sighting — the map should not present the two as equal.
 */
export function getIncidentStyle(kind: string, reportCount: number) {
  const corroborated = reportCount >= 2;

  switch (kind) {
    case 'flooding':
      return { color: '#5c9cd6', corroborated };
    case 'road_blocked':
      return { color: colors.danger, corroborated };
    case 'police':
      return { color: colors.violet, corroborated };
    case 'smoke':
      return { color: colors.muted, corroborated };
    default:
      return { color: colors.gold, corroborated };
  }
}
