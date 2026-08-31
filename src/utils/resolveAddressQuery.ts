import {
  geocodeLandmarks,
  lookupAddress,
  parseAddress,
  reverseLookup,
  searchPlaces,
  type LocationLookupResponse,
  type RecentSearchResultType,
  type SearchResult,
} from '../api/search';

export type ResolvedFindGpsResult = {
  gpsCode: string;
  displayName: string;
  latitude: number;
  longitude: number;
  /** Most specific line of the address, when the API has one. */
  street?: string;
  region?: string;
  district?: string;
  area?: string;
  postcode?: string;
  qualityScore?: number;
  googleMapsUrl?: string;
  source: 'lookup' | 'search' | 'reverse';
};

export type AddressResolution =
  | { status: 'resolved'; result: ResolvedFindGpsResult; resultType: RecentSearchResultType }
  | { status: 'empty'; didYouMean?: string };

/**
 * The FindGPS fallback chain (mirrors web `FindGPS.tsx`): GPS/hex codes short-circuit to
 * a direct lookup; free text goes through address parsing, then place search, then a
 * reverse lookup, then anchor landmarks — trying each only when the previous step
 * returns nothing usable. Shared by FindGPS and Directions so both features resolve a
 * typed query the same way instead of maintaining two copies of this chain.
 */
export async function resolveAddressQuery(rawQuery: string): Promise<AddressResolution> {
  const query = rawQuery.trim();

  if (isCodeLike(query)) {
    const lookup = await lookupAddress(query);

    return { status: 'resolved', result: mapLookupResult(lookup, 'lookup'), resultType: 'gps' };
  }

  const parsedAddress = await parseAddress(query);
  const parsedCode = getParsedCode(parsedAddress.parsed);

  if (parsedAddress.is_code && parsedCode) {
    const lookup = await lookupAddress(parsedCode);

    return { status: 'resolved', result: mapLookupResult(lookup, 'lookup'), resultType: 'gps' };
  }

  const geocodeQuery = getParsedGeocodeQuery(parsedAddress.parsed) ?? query;
  const searchResponse = await searchPlaces({ q: geocodeQuery, limit: 1 });
  const firstSearchResult = searchResponse.results[0];

  if (firstSearchResult?.gps_name) {
    const lookup = await lookupAddress(firstSearchResult.gps_name);

    return {
      status: 'resolved',
      result: mapLookupResult(lookup, 'lookup', firstSearchResult.name),
      resultType: getSearchResultType(firstSearchResult),
    };
  }

  if (firstSearchResult) {
    const lookup = await reverseLookup({
      lat: firstSearchResult.latitude,
      lng: firstSearchResult.longitude,
    });

    return {
      status: 'resolved',
      result: mapLookupResult(lookup, 'reverse', firstSearchResult.name),
      resultType: getSearchResultType(firstSearchResult),
    };
  }

  for (const anchor of parsedAddress.parsed.anchors ?? []) {
    const anchorResponse = await geocodeLandmarks({ q: anchor.name, limit: 3 });
    const firstMatch = anchorResponse.matches[0];

    if (firstMatch) {
      const lookup = await reverseLookup({
        lat: firstMatch.centroid.lat,
        lng: firstMatch.centroid.lng,
      });

      return {
        status: 'resolved',
        result: mapLookupResult(lookup, 'reverse', firstMatch.name),
        resultType: 'landmark',
      };
    }
  }

  return { status: 'empty', didYouMean: searchResponse.did_you_mean };
}

/**
 * Coarse bounding box for Ghana, padded slightly beyond the national extents.
 * Used only to fail fast with a message the user can act on — the API stays the
 * authority on whether a point actually has an AfriHex address.
 */
const GHANA_BOUNDS = {
  minLatitude: 4.5,
  maxLatitude: 11.25,
  minLongitude: -3.35,
  maxLongitude: 1.25,
} as const;

export const OUTSIDE_GHANA_MESSAGE =
  'This location is outside Ghana. AfriHex addresses cover Ghana only — search a Ghanaian place or GPS code instead.';

export function isWithinGhana(lat: number, lng: number) {
  return (
    lat >= GHANA_BOUNDS.minLatitude &&
    lat <= GHANA_BOUNDS.maxLatitude &&
    lng >= GHANA_BOUNDS.minLongitude &&
    lng <= GHANA_BOUNDS.maxLongitude
  );
}

/** Resolves an already-known coordinate pair (current location, map tap) to a display result. */
export async function resolveCoordinates(lat: number, lng: number): Promise<ResolvedFindGpsResult> {
  if (!isWithinGhana(lat, lng)) {
    // In development the rejected coordinate is appended so it shows up on screen
    // rather than only in Metro. Callers branching on this message match its
    // prefix, not the whole string.
    throw new Error(__DEV__ ? `${OUTSIDE_GHANA_MESSAGE} [dev: ${lat}, ${lng}]` : OUTSIDE_GHANA_MESSAGE);
  }

  const lookup = await reverseLookup({ lat, lng });

  return mapLookupResult(lookup, 'reverse');
}

export function mapLookupResult(
  lookup: LocationLookupResponse,
  source: ResolvedFindGpsResult['source'],
  displayNameOverride?: string,
): ResolvedFindGpsResult {
  // Ghana's metro districts often repeat their name as the area (Kumasi, Kumasi),
  // so identical parts are collapsed rather than printed twice.
  const locality = uniqueLocalityParts([lookup.street, lookup.area, lookup.district, lookup.region]).join(', ');

  return {
    gpsCode: lookup.gps_name,
    displayName: displayNameOverride ?? (locality || lookup.address),
    latitude: lookup.center_latitude,
    longitude: lookup.center_longitude,
    street: lookup.street,
    region: lookup.region,
    district: lookup.district,
    area: lookup.area,
    postcode: lookup.postcode,
    qualityScore: lookup.quality_score,
    googleMapsUrl: lookup.google_maps_url,
    source,
  };
}

/**
 * Address parts in order, dropping blanks and any repeat of a part already used.
 * Comparison is case- and whitespace-insensitive so "Kumasi" and "kumasi " count
 * as one.
 */
export function uniqueLocalityParts(parts: Array<string | undefined | null>) {
  const seen = new Set<string>();

  return parts.reduce<string[]>((kept, part) => {
    const value = part?.trim();

    if (!value) {
      return kept;
    }

    const key = value.toLowerCase();

    if (seen.has(key)) {
      return kept;
    }

    seen.add(key);
    kept.push(value);

    return kept;
  }, []);
}

export function isCodeLike(query: string) {
  const normalized = query.trim().toUpperCase();

  return /^[A-Z]{1,4}-?\d{3}-?\d{4}$/.test(normalized) || /^AF-GH-[A-Z0-9-]+$/.test(normalized);
}

function getParsedCode(parsed: Record<string, unknown>) {
  return getString(parsed.gps_name) ?? getString(parsed.gps_code) ?? getString(parsed.code);
}

function getParsedGeocodeQuery(parsed: Record<string, unknown>) {
  return getString(parsed.geocode_query);
}

function getSearchResultType(result: SearchResult): RecentSearchResultType {
  if (result.type === 'landmark') {
    return 'landmark';
  }

  return 'place';
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}
