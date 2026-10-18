import type { RoutePoint } from '../../../api/route';

const EARTH_RADIUS_M = 6_371_000;

/**
 * Ground metres per degree of latitude. Longitude is scaled by the cosine of the
 * latitude wherever a planar approximation is used, so one degree east is
 * shorter than one degree north away from the equator.
 */
const METERS_PER_DEGREE_LAT = 111_320;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/** Great-circle distance. Accurate enough at the scale of a city route. */
export function distanceMeters(a: RoutePoint, b: RoutePoint) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The route flattened into metres-from-the-start, so that progress along the
 * trip is a single number every other calculation can compare against.
 *
 * Built once per planned route rather than per fix: a 15 km Accra route carries
 * a few thousand vertices, and re-walking them on every GPS update would put
 * that work in the render path for no benefit.
 */
export type RouteProjection = {
  vertices: RoutePoint[];
  /** Ground distance from the route start to each vertex. Same length as `vertices`. */
  cumulativeM: number[];
  totalM: number;
};

/**
 * @param coordinates `[lng, lat]` pairs exactly as the API returns them. The
 * swap to `{lat, lng}` happens here, once, rather than in every consumer.
 */
export function projectRoute(coordinates: Array<[number, number]>): RouteProjection {
  const vertices: RoutePoint[] = [];
  const cumulativeM: number[] = [];

  let running = 0;

  for (const [lng, lat] of coordinates) {
    const point = { lat, lng };

    if (vertices.length > 0) {
      running += distanceMeters(vertices[vertices.length - 1], point);
    }

    vertices.push(point);
    cumulativeM.push(running);
  }

  return { vertices, cumulativeM, totalM: running };
}

export type RouteSnap = {
  /** Ground distance from the snapped point back to the queried position. */
  offsetM: number;
  /** Ground distance from the route start to the snapped point. */
  travelledM: number;
  /** Index of the segment the snap landed on. */
  segmentIndex: number;
  point: RoutePoint;
};

export type SnapOptions = {
  /**
   * Metres along the route the caller last saw the device at. Supplying it
   * narrows the scan to a window around that point, which is what keeps a fix
   * O(window) instead of O(route length). Omit it only for a cold first fix.
   */
  fromM?: number;
  /** Half-width of the search window, in metres. */
  windowM?: number;
};

const DEFAULT_WINDOW_M = 400;

/**
 * Projects a position onto the route and reports how far along it sits.
 *
 * This is what makes guidance possible without a full map-matching engine: the
 * device's offset from the line is the same number that decides whether the
 * user is on the route at all, so off-route detection and step progress share
 * one calculation rather than two that can disagree.
 */
export function snapToRoute(position: RoutePoint, projection: RouteProjection, options: SnapOptions = {}): RouteSnap {
  const { vertices, cumulativeM } = projection;

  if (vertices.length === 0) {
    return { offsetM: 0, travelledM: 0, segmentIndex: -1, point: position };
  }

  if (vertices.length === 1) {
    return {
      offsetM: distanceMeters(position, vertices[0]),
      travelledM: 0,
      segmentIndex: -1,
      point: vertices[0],
    };
  }

  let firstSegment = 0;
  let lastSegment = vertices.length - 2;

  if (options.fromM !== undefined) {
    const windowM = options.windowM ?? DEFAULT_WINDOW_M;
    const low = options.fromM - windowM;
    const high = options.fromM + windowM;

    // Segments are cumulative and ascending, so a binary search for the window
    // bounds is enough to bound the scan.
    firstSegment = lowerBound(cumulativeM, low);
    lastSegment = Math.min(vertices.length - 2, lowerBound(cumulativeM, high) + 1);

    // A fix that jumped further than the window — a new route, a resumed
    // session, or a genuinely wrong first reading — would otherwise find
    // nothing and pin the user to the window edge. Fall back to the whole line.
    if (lastSegment < firstSegment) {
      firstSegment = 0;
      lastSegment = vertices.length - 2;
    }
  }

  let best: RouteSnap | null = null;

  for (let index = firstSegment; index <= lastSegment; index += 1) {
    const candidate = projectOntoSegment(position, vertices[index], vertices[index + 1]);
    const segmentStartM = cumulativeM[index];
    const segmentLengthM = cumulativeM[index + 1] - segmentStartM;
    const travelledM = segmentStartM + candidate.distanceAlongM;

    if (best === null || candidate.distanceM < best.offsetM) {
      best = {
        offsetM: candidate.distanceM,
        travelledM: segmentLengthM === 0 ? segmentStartM : travelledM,
        segmentIndex: index,
        point: candidate.point,
      };
    }
  }

  // Unreachable: the loop always runs at least once for a two-vertex route, and
  // the empty and single-vertex cases returned above.
  return best ?? { offsetM: 0, travelledM: 0, segmentIndex: 0, point: position };
}

/** Index of the first entry in an ascending array that is not below `target`. */
function lowerBound(sorted: number[], target: number) {
  let low = 0;
  let high = sorted.length;

  while (low < high) {
    const mid = (low + high) >> 1;

    if (sorted[mid] < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

/**
 * Snaps `position` to the closest point on a straight line between `a` and `b`.
 *
 * Works in a local planar frame centred on the query point. Over the tens of
 * metres a GPS error radius covers, the earth's curvature is orders of magnitude
 * smaller than that error, so the flat approximation is exact enough here and far
 * cheaper than a geodesic solution.
 */
function projectOntoSegment(position: RoutePoint, a: RoutePoint, b: RoutePoint) {
  const latScale = METERS_PER_DEGREE_LAT;
  const lngScale = METERS_PER_DEGREE_LAT * Math.cos(toRadians(position.lat));

  // The query point becomes the local origin, so it lands on (0, 0).
  const ax = (a.lng - position.lng) * lngScale;
  const ay = (a.lat - position.lat) * latScale;
  const bx = (b.lng - position.lng) * lngScale;
  const by = (b.lat - position.lat) * latScale;

  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;

  // Route steps repeat a vertex at a manoeuvre, producing a zero-length segment
  // that would divide by zero. Treating it as a bare point keeps the scan going.
  const t = lengthSq === 0 ? 0 : clamp((-ax * dx - ay * dy) / lengthSq, 0, 1);

  const px = ax + t * dx;
  const py = ay + t * dy;

  return {
    point: { lat: position.lat + py / latScale, lng: position.lng + px / lngScale },
    distanceM: Math.hypot(px, py),
    distanceAlongM: Math.hypot(px - ax, py - ay),
  };
}
