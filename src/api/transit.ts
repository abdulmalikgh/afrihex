import { apiRequest, buildApiPath, getNumber, getOptionalNumber, getOptionalString, isObject } from './client';

/**
 * Trotro and bus. Both endpoints are enveloped (`{ success, data }`) and both
 * are public — `/v2/transit/departures` sits on the `isPublicPath()` allowlist
 * alongside the other anonymous directions reads, so nothing here is gated on
 * having signed in.
 */

export type TransitDeparture = {
  shortName: string;
  longName?: string;
  mode: string;
  destination?: string;
  destLat?: number;
  destLng?: number;
  destDistanceM?: number;
  stopName?: string;
  stopLat?: number;
  stopLng?: number;
  /** Walking distance to the stop, in metres. */
  stopDistanceM?: number;
};

export type TransitDeparturesResponse = {
  routes: TransitDeparture[];
  count: number;
  stops: string[];
  /**
   * Only present when `count` is 0 — and it distinguishes "nothing nearby" from
   * "everything here terminates, walk on", which `note` then explains.
   */
  noRoutes: boolean;
  note?: string;
};

/** What can be boarded near a point right now. `radiusM` is 1–2000, default 400. */
export function getTransitDepartures({
  lat,
  lng,
  radiusM,
}: {
  lat: number;
  lng: number;
  radiusM?: number;
}): Promise<TransitDeparturesResponse> {
  return apiRequest({
    path: buildApiPath('/v2/transit/departures', { lat, lng, radius_m: radiusM }),
    parseData: (data) => {
      if (!isObject(data)) {
        throw new Error('Departures response has an unexpected shape.');
      }

      const routes = Array.isArray(data.routes) ? data.routes : [];

      return {
        count: getNumber(data.count, routes.length),
        noRoutes: data.no_routes === true,
        note: getOptionalString(data.note),
        stops: Array.isArray(data.stops)
          ? data.stops.filter((stop): stop is string => typeof stop === 'string')
          : [],
        routes: routes.flatMap((route) => {
          if (!isObject(route)) {
            return [];
          }

          const shortName = getOptionalString(route.short_name);

          if (!shortName) {
            return [];
          }

          return [
            {
              shortName,
              longName: getOptionalString(route.long_name),
              mode: getOptionalString(route.mode) ?? 'BUS',
              destination: getOptionalString(route.destination),
              destLat: getOptionalNumber(route.dest_lat),
              destLng: getOptionalNumber(route.dest_lng),
              destDistanceM: getOptionalNumber(route.dest_distance_m),
              stopName: getOptionalString(route.stop_name),
              stopLat: getOptionalNumber(route.stop_lat),
              stopLng: getOptionalNumber(route.stop_lng),
              stopDistanceM: getOptionalNumber(route.stop_distance_m),
            },
          ];
        }),
      };
    },
  });
}

export type TransitLeg = {
  mode: string;
  durationS?: number;
  distanceM?: number;
  fromName?: string;
  toName?: string;
  routeShortName?: string;
  routeLongName?: string;
};

export type TransitItinerary = {
  durationS?: number;
  walkDistanceM?: number;
  transfers?: number;
  legs: TransitLeg[];
};

export type TransitTrip = {
  shortName?: string;
  longName?: string;
  stopName?: string;
  /** `HH:MM` local. */
  time?: string;
};

export type TransitPlan = {
  itineraries: TransitItinerary[];
  count: number;
  /**
   * True whenever **every** itinerary is walk-only, including an empty list —
   * so "no service" must be read off this, not off `count === 0`. OTP answers a
   * missing route with a plain walking plan, and a 91-minute walk is not a
   * transit option.
   */
  noTransit: boolean;
  note?: string;
  /** Set when the miss is "too early". Never set alongside `lastTrip`. */
  firstTrip?: TransitTrip;
  /** Set when the miss is "already gone for the day". */
  lastTrip?: TransitTrip;
};

function parseTrip(value: unknown): TransitTrip | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  return {
    shortName: getOptionalString(value.short_name),
    longName: getOptionalString(value.long_name),
    stopName: getOptionalString(value.stop_name),
    time: getOptionalString(value.time),
  };
}

/** Plans a trotro/bus trip. `date`/`time` default to now. */
export function planTransit(body: {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  date?: string;
  time?: string;
}): Promise<TransitPlan> {
  return apiRequest({
    path: '/v2/route/transit',
    method: 'POST',
    body: {
      from_lat: body.fromLat,
      from_lng: body.fromLng,
      to_lat: body.toLat,
      to_lng: body.toLng,
      ...(body.date ? { date: body.date } : {}),
      ...(body.time ? { time: body.time } : {}),
    },
    parseData: (data) => {
      if (!isObject(data)) {
        throw new Error('Transit response has an unexpected shape.');
      }

      const itineraries = Array.isArray(data.itineraries) ? data.itineraries : [];

      return {
        count: getNumber(data.count, itineraries.length),
        noTransit: data.no_transit === true,
        note: getOptionalString(data.note),
        firstTrip: parseTrip(data.first_trip),
        lastTrip: parseTrip(data.last_trip),
        itineraries: itineraries.flatMap((itinerary) => {
          if (!isObject(itinerary)) {
            return [];
          }

          const legs = Array.isArray(itinerary.legs) ? itinerary.legs : [];

          return [
            {
              durationS: getOptionalNumber(itinerary.duration_s),
              walkDistanceM: getOptionalNumber(itinerary.walk_distance_m),
              transfers: getOptionalNumber(itinerary.transfers),
              legs: legs.flatMap((leg) => {
                if (!isObject(leg)) {
                  return [];
                }

                return [
                  {
                    mode: getOptionalString(leg.mode) ?? 'WALK',
                    durationS: getOptionalNumber(leg.duration_s),
                    distanceM: getOptionalNumber(leg.distance_m),
                    fromName: getOptionalString(leg.from_name),
                    toName: getOptionalString(leg.to_name),
                    routeShortName: getOptionalString(leg.route_short_name),
                    routeLongName: getOptionalString(leg.route_long_name),
                  },
                ];
              }),
            },
          ];
        }),
      };
    },
  });
}

export type VoiceCommandResult = {
  recognized: boolean;
  destination?: string;
  /** The same shape `/v2/search/autocomplete` returns. */
  candidates: Array<{ name: string; display_name: string; latitude: number; longitude: number }>;
};

/**
 * Turns an already-transcribed phrase into a destination search.
 *
 * Transcription is the client's job — this only parses text. It never routes on
 * its own, so the caller confirms a candidate with the user and calls `/v2/route`
 * itself. Public: a login wall here would defeat the point of a speak-to-navigate
 * shortcut.
 */
export function parseVoiceCommand({
  transcript,
  lat,
  lng,
}: {
  transcript: string;
  lat?: number;
  lng?: number;
}): Promise<VoiceCommandResult> {
  return apiRequest({
    path: '/v2/navigate/voice-command',
    method: 'POST',
    body: {
      transcript,
      ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}),
    },
    parseData: (data) => {
      if (!isObject(data)) {
        return { recognized: false, candidates: [] };
      }

      const candidates = isObject(data.candidates) && Array.isArray(data.candidates.results)
        ? data.candidates.results
        : [];

      return {
        recognized: data.recognized === true,
        destination: getOptionalString(data.destination),
        candidates: candidates.flatMap((candidate) => {
          if (
            !isObject(candidate) ||
            typeof candidate.latitude !== 'number' ||
            typeof candidate.longitude !== 'number'
          ) {
            return [];
          }

          const name = getOptionalString(candidate.name) ?? 'Place';

          return [
            {
              name,
              display_name: getOptionalString(candidate.display_name) ?? name,
              latitude: candidate.latitude,
              longitude: candidate.longitude,
            },
          ];
        }),
      };
    },
  });
}
