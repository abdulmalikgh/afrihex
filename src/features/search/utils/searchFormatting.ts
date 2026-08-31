import { uniqueLocalityParts } from '../../../utils/resolveAddressQuery';
import type { ResolvedFindGpsResult } from '../hooks/useFindGpsSearch';

export function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function formatCoordinate(value: number) {
  return value.toFixed(6);
}

/**
 * The one line that names the place: its street where the API has one, otherwise
 * the smallest administrative name it gave us. Deliberately short — the wider
 * context belongs in the subtitle, not stacked into a single run-on line.
 */
export function getPlaceTitle(result: ResolvedFindGpsResult) {
  const [mostSpecific] = uniqueLocalityParts([result.street, result.area, result.district, result.region]);

  return mostSpecific ?? result.displayName;
}

/**
 * Everything above the title, largest last: "Kumasi · Ashanti". Parts already
 * spent on the title are dropped, as are repeats — a district that shares its
 * area's name would otherwise read "Kumasi · Kumasi · Ashanti".
 */
export function getPlaceSubtitle(result: ResolvedFindGpsResult) {
  const [, ...rest] = uniqueLocalityParts([result.street, result.area, result.district, result.region]);

  return rest.join(' · ');
}

export function getSearchLabel(result: ResolvedFindGpsResult) {
  const shortLabel = uniqueLocalityParts([result.area, result.district]).join(', ');

  return shortLabel || result.displayName;
}

/** True once quality drops low enough to be worth calling out to the user. */
export function isLowQuality(score: number | undefined) {
  if (typeof score !== 'number') {
    return false;
  }

  return score <= 1 ? score < 0.7 : score < 70;
}

/**
 * What gets shared: the code, the place in words, the coordinates, and the map
 * link when there is one. The old version repeated region, district and area as
 * labelled lines even though `displayName` already contains all three.
 */
export function getAddressText(result: ResolvedFindGpsResult) {
  return [
    result.gpsCode,
    result.displayName,
    `${formatCoordinate(result.latitude)}, ${formatCoordinate(result.longitude)}`,
    result.googleMapsUrl,
  ]
    .filter(Boolean)
    .join('\n');
}
