import {
  apiRequest,
  buildApiPath,
  getNumber,
  getOptionalNumber,
  getOptionalString,
  isObject,
} from './client';

export type AutocompleteResult = {
  name: string;
  display_name: string;
  latitude: number;
  longitude: number;
};

export type AutocompleteResponse = {
  query: string;
  count: number;
  results: AutocompleteResult[];
};

export type LocationLookupResponse = {
  gps_name: string;
  address: string;
  /**
   * Administrative fields go empty outside the big cities, and this same shape is
   * reused for every entry in a `/v2/nearby` page — so one thin row must not be
   * able to discard the whole response.
   */
  region?: string;
  district?: string;
  area?: string;
  postcode?: string;
  street?: string;
  center_latitude: number;
  center_longitude: number;
  north_latitude?: number;
  south_latitude?: number;
  east_longitude?: number;
  west_longitude?: number;
  google_maps_url?: string;
  quality_score?: number;
};

export type AddressParseAnchor = {
  relation?: string;
  name: string;
};

export type AddressParseResponse = {
  query: string;
  is_code: boolean;
  parsed: {
    anchors?: AddressParseAnchor[];
    code?: string;
    gps_code?: string;
    gps_name?: string;
    geocode_query?: string;
  } & Record<string, unknown>;
};

export type SearchResult = {
  type: string;
  name: string;
  gps_name?: string;
  region?: string;
  district?: string;
  area?: string;
  postcode?: string;
  latitude: number;
  longitude: number;
  google_maps_url?: string;
};

export type SearchResponse = {
  query: string;
  count: number;
  results: SearchResult[];
  did_you_mean?: string;
};

export type NearbyResponse = {
  origin: LocationLookupResponse;
  radius_km: number;
  count: number;
  has_more: boolean;
  next_cursor?: string;
  locations: Array<{
    location: LocationLookupResponse;
    distance_km: number;
  }>;
};

export type LandmarkMatch = {
  id: number;
  slug: string;
  name: string;
  kind: string;
  region_code: string;
  source?: string;
  confidence: number;
  centroid: {
    lng: number;
    lat: number;
  };
  score?: number;
  distance_m?: number;
  street?: string;
  postcode?: string;
  photo_url?: string;
};

export type LandmarkGeocodeResponse = {
  query?: string;
  count?: number;
  matches: LandmarkMatch[];
};

export type LandmarkAroundResponse = {
  lat: number;
  lng: number;
  radius: number;
  /** Total POIs in radius — not the number of kinds. Omitted by some responses. */
  count?: number;
  by_kind: Array<{
    kind: string;
    count: number;
  }>;
};

export type RecentSearchResultType = 'gps' | 'place' | 'landmark' | 'poi';

export type RecentSearch = {
  id: number;
  query: string;
  /** Optional: the API documents `query` as the only required field. */
  result_type?: RecentSearchResultType;
  result_ref?: string;
  display_name?: string;
  lat?: number;
  lng?: number;
  search_count: number;
  last_searched_at: string;
};

export type RecentSearchesResponse = {
  count: number;
  searches: RecentSearch[];
};

export type RecordRecentSearchRequest = {
  query: string;
  result_type?: RecentSearchResultType;
  result_ref?: string;
  display_name?: string;
  lat?: number;
  lng?: number;
};

type AutocompleteParams = {
  q: string;
  limit?: number;
  lat?: number;
  lng?: number;
};

type SearchParams = {
  q: string;
  limit?: number;
  offset?: number;
};

type ReverseParams = {
  lat: number;
  lng: number;
};

type NearbyParams = ReverseParams & {
  radius?: number;
  limit?: number;
  /** `next_cursor` from the previous page. Omit for the first page. */
  cursor?: string;
};

type LandmarkAroundParams = ReverseParams & {
  radius?: number;
};

type GeocodeLandmarksParams =
  | {
      q: string;
      limit?: number;
    }
  | {
      near: string;
      /** Omitted returns every kind near the point — how the claim flow finds "the shop I am standing in". */
      kind?: string;
      radius?: number;
      limit?: number;
    };

export function autocompleteSearch({
  q,
  limit = 8,
  lat,
  lng,
}: AutocompleteParams): Promise<AutocompleteResponse> {
  return apiRequest({
    path: buildApiPath('/v2/search/autocomplete', { q, limit, lat, lng }),
    parseData: parseAutocompleteResponse,
  });
}

export function searchPlaces({ q, limit = 10, offset }: SearchParams): Promise<SearchResponse> {
  return apiRequest({
    path: buildApiPath('/v2/search', { q, limit, offset }),
    parseData: parseSearchResponse,
  });
}

export function lookupAddress(address: string): Promise<LocationLookupResponse> {
  return apiRequest({
    path: buildApiPath('/v2/lookup', { address }),
    parseData: parseLocationLookupResponse,
  });
}

export function reverseLookup({ lat, lng }: ReverseParams): Promise<LocationLookupResponse> {
  return apiRequest({
    path: buildApiPath('/v2/reverse', { lat, lng }),
    parseData: parseLocationLookupResponse,
  });
}

export function parseAddress(q: string): Promise<AddressParseResponse> {
  return apiRequest({
    path: buildApiPath('/v2/address/parse', { q }),
    parseData: parseAddressParseResponse,
  });
}

export function getNearbyPlaces({
  lat,
  lng,
  radius = 0.5,
  limit = 5,
  cursor,
}: NearbyParams): Promise<NearbyResponse> {
  return apiRequest({
    // `cursor` is omitted by `buildApiPath` when undefined, so the first page is
    // the same request it always was.
    path: buildApiPath('/v2/nearby', { lat, lng, radius, limit, cursor }),
    parseData: parseNearbyResponse,
  });
}

export function getLandmarkAround({
  lat,
  lng,
  radius = 2000,
}: LandmarkAroundParams): Promise<LandmarkAroundResponse> {
  return apiRequest({
    path: buildApiPath('/v2/landmarks/around', { lat, lng, radius }),
    parseData: parseLandmarkAroundResponse,
  });
}

export function geocodeLandmarks(params: GeocodeLandmarksParams): Promise<LandmarkGeocodeResponse> {
  return apiRequest({
    path: buildApiPath('/v2/landmarks/geocode', params),
    parseData: parseLandmarkGeocodeResponse,
  });
}

/**
 * What sits in and around a hex cell.
 *
 * Two arrays, not one: `inside` is landmarks whose polygon contains the cell
 * centroid, `nearby` is landmarks within a buffer that do not contain it. They
 * are different server structs rather than one shape with optional fields —
 * only `nearby` carries `distance_m`, because distance is meaningless for
 * something you are standing inside.
 */
export type HexcodeLandmark = {
  slug: string;
  name: string;
  kind: string;
  source?: string;
  confidence?: number;
  /** Present on `nearby` entries only. Metres. */
  distance_m?: number;
  /** Present on `inside` entries only. Raw GeoJSON. */
  geometry?: unknown;
  containment: 'inside' | 'nearby';
};

export type HexcodeLandmarksResponse = {
  hex: string;
  inside: HexcodeLandmark[];
  nearby: HexcodeLandmark[];
};

/** Public — the whole `/v2/hexcode` tree is H3 geometry with no tenant state. */
export function getHexcodeLandmarks(hexCode: string): Promise<HexcodeLandmarksResponse> {
  return apiRequest({
    path: `/v2/hexcode/${encodeURIComponent(hexCode)}/landmarks`,
    parseData: (data) => {
      if (!isObject(data)) {
        return { hex: hexCode, inside: [], nearby: [] };
      }

      return {
        hex: getOptionalString(data.hex) ?? hexCode,
        inside: parseHexcodeLandmarks(data.inside, 'inside'),
        nearby: parseHexcodeLandmarks(data.nearby, 'nearby'),
      };
    },
  });
}

function parseHexcodeLandmarks(value: unknown, containment: 'inside' | 'nearby'): HexcodeLandmark[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isObject(entry)) {
      return [];
    }

    const slug = getOptionalString(entry.slug);
    const name = getOptionalString(entry.name);

    if (!slug || !name) {
      return [];
    }

    return [
      {
        slug,
        name,
        kind: getOptionalString(entry.kind) ?? 'landmark',
        source: getOptionalString(entry.source),
        confidence: getOptionalNumber(entry.confidence),
        distance_m: getOptionalNumber(entry.distance_m),
        geometry: entry.geometry,
        containment,
      },
    ];
  });
}

export type HexcodeForPoint = {
  code: string;
  h3Index?: string;
  resolution?: number;
  center?: { lat: number; lng: number };
  areaKm2?: number;
  /**
   * Omitted entirely when the point did not resolve against a known
   * GhanaPostGPS address — check for presence, not for an empty string.
   */
  gpsCode?: string;
  region?: string;
  district?: string;
  area?: string;
};

/**
 * Coordinates to a hex code. Public, pure geometry.
 *
 * This is what lets the rest of the app hold a hex at all: search, lookup and
 * reverse never return one, so before this every hex-keyed feature was limited
 * to the one screen that happened to have a code already.
 */
export function getHexcodeForPoint({
  lat,
  lng,
  res,
}: {
  lat: number;
  lng: number;
  res?: number;
}): Promise<HexcodeForPoint> {
  return apiRequest({
    path: buildApiPath('/v2/hexcode', { lat, lng, res }),
    parseData: (data) => {
      if (!isObject(data) || typeof data.code !== 'string') {
        throw new Error('Hexcode response has an unexpected shape.');
      }

      const center = isObject(data.center) ? data.center : undefined;

      return {
        code: data.code,
        h3Index: getOptionalString(data.h3_index),
        resolution: getOptionalNumber(data.resolution),
        ...(typeof center?.lat === 'number' && typeof center.lng === 'number'
          ? { center: { lat: center.lat, lng: center.lng } }
          : {}),
        areaKm2: getOptionalNumber(data.area_km2),
        gpsCode: getOptionalString(data.gps_code),
        region: getOptionalString(data.region),
        district: getOptionalString(data.district),
        area: getOptionalString(data.area),
      };
    },
  });
}

export function getRecentSearches(limit = 10): Promise<RecentSearchesResponse> {
  return apiRequest({
    path: buildApiPath('/v2/me/recent-searches', { limit }),
    authenticated: true,
    parseData: parseRecentSearchesResponse,
  });
}

export function recordRecentSearch(body: RecordRecentSearchRequest): Promise<void> {
  return apiRequest({
    path: '/v2/me/recent-searches',
    method: 'POST',
    authenticated: true,
    body,
    parseData: () => undefined,
  });
}

export function deleteRecentSearch(id: number): Promise<void> {
  return apiRequest({
    path: `/v2/me/recent-searches/${id}`,
    method: 'DELETE',
    authenticated: true,
    parseData: () => undefined,
  });
}

export function clearRecentSearches(): Promise<void> {
  return apiRequest({
    path: '/v2/me/recent-searches',
    method: 'DELETE',
    authenticated: true,
    parseData: () => undefined,
  });
}

function parseAutocompleteResponse(data: unknown): AutocompleteResponse {
  if (!isObject(data) || typeof data.query !== 'string' || !Array.isArray(data.results)) {
    throw new Error('Autocomplete response has an unexpected shape.');
  }

  return {
    query: data.query,
    count: getNumber(data.count, data.results.length),
    results: data.results.map(parseAutocompleteResult),
  };
}

function parseAutocompleteResult(data: unknown): AutocompleteResult {
  if (
    !isObject(data) ||
    typeof data.name !== 'string' ||
    typeof data.display_name !== 'string' ||
    typeof data.latitude !== 'number' ||
    typeof data.longitude !== 'number'
  ) {
    throw new Error('Autocomplete result has an unexpected shape.');
  }

  return {
    name: data.name,
    display_name: data.display_name,
    latitude: data.latitude,
    longitude: data.longitude,
  };
}

function parseLocationLookupResponse(data: unknown): LocationLookupResponse {
  if (
    !isObject(data) ||
    typeof data.gps_name !== 'string' ||
    typeof data.address !== 'string' ||
    typeof data.center_latitude !== 'number' ||
    typeof data.center_longitude !== 'number'
  ) {
    throw new Error('Location lookup response has an unexpected shape.');
  }

  return {
    gps_name: data.gps_name,
    address: data.address,
    region: getOptionalString(data.region),
    district: getOptionalString(data.district),
    area: getOptionalString(data.area),
    postcode: getOptionalString(data.postcode),
    street: getOptionalString(data.street),
    center_latitude: data.center_latitude,
    center_longitude: data.center_longitude,
    north_latitude: getOptionalNumber(data.north_latitude),
    south_latitude: getOptionalNumber(data.south_latitude),
    east_longitude: getOptionalNumber(data.east_longitude),
    west_longitude: getOptionalNumber(data.west_longitude),
    google_maps_url: getOptionalString(data.google_maps_url),
    // Absent means the server did not score it — not that it scored zero.
    quality_score: getOptionalNumber(data.quality_score),
  };
}

function parseAddressParseResponse(data: unknown): AddressParseResponse {
  if (!isObject(data) || typeof data.query !== 'string' || typeof data.is_code !== 'boolean') {
    throw new Error('Address parse response has an unexpected shape.');
  }

  const parsed = isObject(data.parsed) ? data.parsed : {};

  return {
    query: data.query,
    is_code: data.is_code,
    parsed: {
      ...parsed,
      anchors: Array.isArray(parsed.anchors) ? parsed.anchors.map(parseAddressAnchor) : undefined,
      code: getOptionalString(parsed.code),
      gps_code: getOptionalString(parsed.gps_code),
      gps_name: getOptionalString(parsed.gps_name),
      geocode_query: getOptionalString(parsed.geocode_query),
    },
  };
}

function parseAddressAnchor(data: unknown): AddressParseAnchor {
  if (!isObject(data) || typeof data.name !== 'string') {
    throw new Error('Address parse anchor has an unexpected shape.');
  }

  return {
    name: data.name,
    relation: getOptionalString(data.relation),
  };
}

function parseSearchResponse(data: unknown): SearchResponse {
  if (!isObject(data) || typeof data.query !== 'string' || !Array.isArray(data.results)) {
    throw new Error('Search response has an unexpected shape.');
  }

  return {
    query: data.query,
    count: getNumber(data.count, data.results.length),
    results: data.results.map(parseSearchResult),
    did_you_mean: getOptionalString(data.did_you_mean),
  };
}

function parseSearchResult(data: unknown): SearchResult {
  if (
    !isObject(data) ||
    typeof data.type !== 'string' ||
    typeof data.name !== 'string' ||
    typeof data.latitude !== 'number' ||
    typeof data.longitude !== 'number'
  ) {
    throw new Error('Search result has an unexpected shape.');
  }

  return {
    type: data.type,
    name: data.name,
    gps_name: getOptionalString(data.gps_name),
    region: getOptionalString(data.region),
    district: getOptionalString(data.district),
    area: getOptionalString(data.area),
    postcode: getOptionalString(data.postcode),
    latitude: data.latitude,
    longitude: data.longitude,
    google_maps_url: getOptionalString(data.google_maps_url),
  };
}

function parseNearbyResponse(data: unknown): NearbyResponse {
  if (
    !isObject(data) ||
    !isObject(data.origin) ||
    typeof data.radius_km !== 'number' ||
    !Array.isArray(data.locations)
  ) {
    throw new Error('Nearby response has an unexpected shape.');
  }

  return {
    origin: parseLocationLookupResponse(data.origin),
    radius_km: data.radius_km,
    count: getNumber(data.count, data.locations.length),
    has_more: Boolean(data.has_more),
    next_cursor: getOptionalString(data.next_cursor),
    locations: data.locations.map(parseNearbyLocation),
  };
}

function parseNearbyLocation(data: unknown): NearbyResponse['locations'][number] {
  if (!isObject(data) || !isObject(data.location) || typeof data.distance_km !== 'number') {
    throw new Error('Nearby location has an unexpected shape.');
  }

  return {
    location: parseLocationLookupResponse(data.location),
    distance_km: data.distance_km,
  };
}

function parseLandmarkAroundResponse(data: unknown): LandmarkAroundResponse {
  if (
    !isObject(data) ||
    typeof data.lat !== 'number' ||
    typeof data.lng !== 'number' ||
    typeof data.radius !== 'number' ||
    !Array.isArray(data.by_kind)
  ) {
    throw new Error('Landmark around response has an unexpected shape.');
  }

  return {
    lat: data.lat,
    lng: data.lng,
    radius: data.radius,
    // `count` is the total POIs (the capture shows 404 across 9 kinds), so the
    // number of kinds is never a sane stand-in for it.
    count: getOptionalNumber(data.count),
    by_kind: data.by_kind.map(parseKindCount),
  };
}

function parseKindCount(data: unknown): LandmarkAroundResponse['by_kind'][number] {
  if (!isObject(data) || typeof data.kind !== 'string' || typeof data.count !== 'number') {
    throw new Error('Landmark kind count has an unexpected shape.');
  }

  return {
    kind: data.kind,
    count: data.count,
  };
}

function parseLandmarkGeocodeResponse(data: unknown): LandmarkGeocodeResponse {
  if (!isObject(data) || !Array.isArray(data.matches)) {
    throw new Error('Landmark geocode response has an unexpected shape.');
  }

  return {
    query: getOptionalString(data.query),
    count: getOptionalNumber(data.count),
    matches: data.matches.map(parseLandmarkMatch),
  };
}

function parseLandmarkMatch(data: unknown): LandmarkMatch {
  if (
    !isObject(data) ||
    typeof data.id !== 'number' ||
    typeof data.slug !== 'string' ||
    typeof data.name !== 'string' ||
    typeof data.kind !== 'string' ||
    typeof data.region_code !== 'string' ||
    typeof data.confidence !== 'number' ||
    !isObject(data.centroid) ||
    typeof data.centroid.lng !== 'number' ||
    typeof data.centroid.lat !== 'number'
  ) {
    throw new Error('Landmark match has an unexpected shape.');
  }

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    kind: data.kind,
    region_code: data.region_code,
    source: getOptionalString(data.source),
    confidence: data.confidence,
    centroid: {
      lng: data.centroid.lng,
      lat: data.centroid.lat,
    },
    score: getOptionalNumber(data.score),
    distance_m: getOptionalNumber(data.distance_m),
    street: getOptionalString(data.street),
    postcode: getOptionalString(data.postcode),
    photo_url: getOptionalString(data.photo_url),
  };
}

function parseRecentSearchesResponse(data: unknown): RecentSearchesResponse {
  if (!isObject(data) || !Array.isArray(data.searches)) {
    throw new Error('Recent searches response has an unexpected shape.');
  }

  return {
    count: getNumber(data.count, data.searches.length),
    searches: data.searches.map(parseRecentSearch),
  };
}

/**
 * Per `mobile-api.md`: "`result_type`: `gps | place | landmark | poi`. Only
 * `query` is required." A row saved without one must not take the whole list
 * down with it, so everything but `query` is read defensively.
 */
function parseRecentSearch(data: unknown): RecentSearch {
  if (!isObject(data) || typeof data.query !== 'string') {
    throw new Error('Recent search response has an unexpected shape.');
  }

  return {
    id: getNumber(data.id, 0),
    query: data.query,
    result_type: isRecentSearchResultType(data.result_type) ? data.result_type : undefined,
    result_ref: getOptionalString(data.result_ref),
    display_name: getOptionalString(data.display_name),
    lat: getOptionalNumber(data.lat),
    lng: getOptionalNumber(data.lng),
    search_count: getNumber(data.search_count, 0),
    last_searched_at: getOptionalString(data.last_searched_at) ?? '',
  };
}

function isRecentSearchResultType(value: unknown): value is RecentSearchResultType {
  return value === 'gps' || value === 'place' || value === 'landmark' || value === 'poi';
}
