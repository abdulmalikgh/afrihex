import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  getFloodZones,
  getLandmarksAlongRoute,
  getPrecipitationForecast,
  getRoadIncidents,
  getWeatherAlerts,
} from '../../../api/navigation';

export type MapLayerKey = 'flood' | 'weather' | 'rain' | 'incidents' | 'landmarks';

export type MapLayerState = Record<MapLayerKey, boolean>;

/**
 * Everything off by default. Each layer is a network call and a few hundred
 * shapes over the route, and someone who opened Directions asked for a route —
 * not for a weather briefing. The control advertises them; it does not impose them.
 */
const DEFAULT_LAYERS: MapLayerState = {
  flood: false,
  weather: false,
  rain: false,
  incidents: false,
  landmarks: false,
};

/**
 * `Cache-Control` on these endpoints is 600s for flood zones and rain, 300s for
 * alerts. Matching `staleTime` to the server's own cache means toggling a layer
 * off and on again is free rather than a second round trip.
 */
const FLOOD_STALE_MS = 600_000;
const WEATHER_STALE_MS = 300_000;
const RAIN_STALE_MS = 600_000;

/**
 * The forecast is a ~165-point grid, and each point renders as a map circle.
 * The response is ordered by probability descending, so keeping the head of it
 * shows every band worth seeing at a fraction of the overlay count — the tail is
 * near-zero-probability points that would cost frames to draw nothing.
 */
const MAX_RAIN_POINTS = 60;

/**
 * Hazard reports are cached 30s server-side and expire per kind — 2h for an
 * accident, 24h for flooding — so this refetches while the layer is on rather
 * than holding a snapshot for the life of the screen.
 */
const INCIDENT_STALE_MS = 30_000;

export function useMapLayers() {
  const [layers, setLayers] = useState<MapLayerState>(DEFAULT_LAYERS);

  const toggle = useCallback((key: MapLayerKey) => {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  const floodZonesQuery = useQuery({
    queryKey: ['map-layers', 'flood-zones'],
    queryFn: getFloodZones,
    enabled: layers.flood,
    staleTime: FLOOD_STALE_MS,
  });

  const weatherAlertsQuery = useQuery({
    queryKey: ['map-layers', 'weather-alerts'],
    queryFn: getWeatherAlerts,
    enabled: layers.weather,
    staleTime: WEATHER_STALE_MS,
  });

  const precipitationQuery = useQuery({
    queryKey: ['map-layers', 'precipitation'],
    queryFn: getPrecipitationForecast,
    enabled: layers.rain,
    staleTime: RAIN_STALE_MS,
  });

  const incidentsQuery = useQuery({
    queryKey: ['map-layers', 'incidents'],
    queryFn: getRoadIncidents,
    enabled: layers.incidents,
    staleTime: INCIDENT_STALE_MS,
    refetchInterval: layers.incidents ? INCIDENT_STALE_MS : false,
  });

  const activeCount = useMemo(
    () => Object.values(layers).filter(Boolean).length,
    [layers],
  );

  return {
    layers,
    toggle,
    activeCount,
    floodZones: layers.flood ? (floodZonesQuery.data ?? []) : [],
    weatherAlerts: layers.weather ? (weatherAlertsQuery.data ?? []) : [],
    precipitation: layers.rain ? (precipitationQuery.data ?? []).slice(0, MAX_RAIN_POINTS) : [],
    incidents: layers.incidents ? (incidentsQuery.data ?? []) : [],
    isLoading:
      (layers.flood && floodZonesQuery.isFetching) ||
      (layers.weather && weatherAlertsQuery.isFetching) ||
      (layers.rain && precipitationQuery.isFetching) ||
      (layers.incidents && incidentsQuery.isFetching),
  };
}

/**
 * Landmarks within 200 m of the planned line. Authenticated and explicitly
 * optional in the API docs, so a signed-out user simply never sees the layer
 * populate — it is never an error state on a screen that has a working route.
 */
export function useRouteLandmarks({
  coordinates,
  enabled,
}: {
  coordinates: Array<[number, number]> | null;
  enabled: boolean;
}) {
  const query = useQuery({
    // The first and last point plus the length identify a route well enough to
    // cache it; hashing several thousand coordinate pairs into a key would cost
    // more than the request it saves.
    queryKey: [
      'route-landmarks',
      coordinates?.length ?? 0,
      coordinates?.[0]?.join(',') ?? '',
      coordinates?.[coordinates.length - 1]?.join(',') ?? '',
    ],
    queryFn: () => getLandmarksAlongRoute({ coordinates: coordinates ?? [], bufferM: 200 }),
    enabled: enabled && !!coordinates && coordinates.length > 1,
    staleTime: 300_000,
    retry: false,
  });

  return enabled ? (query.data ?? []) : [];
}
