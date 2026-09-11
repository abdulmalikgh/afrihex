import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, {
  Circle,
  Marker,
  Polygon,
  Polyline,
  type LatLng,
  type LongPressEvent,
  type Region,
} from 'react-native-maps';
import { Flag } from 'lucide-react-native';

import { AppText } from '../../../components';
import { colors } from '../../../constants/colors';
import { mapDarkStyle } from '../../../constants/mapStyle';
import { mapColors } from '../../../constants/material';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import type { LandmarkPassed } from '../../../api/route';
import type {
  FloodZone,
  PrecipitationPoint,
  RoadIncident,
  RouteLandmark,
  WeatherAlert,
} from '../../../api/navigation';
import type { ResolvedFindGpsResult } from '../../../utils/resolveAddressQuery';
import type { PlannedRoute } from '../types/directions';
import type { AvoidLocation } from '../hooks/useAvoidLocations';
import {
  INACTIVE_ROUTE_STROKE,
  getFloodZoneStyle,
  getIncidentStyle,
  getPrecipitationCircle,
  getWeatherAlertStyle,
} from '../utils/layerStyles';

/**
 * Accra at city zoom. A country-wide delta renders as an empty coastline — no
 * street, town or landmark labels appear until roughly this scale.
 */
const DEFAULT_REGION: Region = {
  latitude: 5.6037,
  longitude: -0.187,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

type RouteMapProps = {
  from: ResolvedFindGpsResult | null;
  to: ResolvedFindGpsResult | null;
  route: PlannedRoute | null;
  /** `null` shows the primary route; otherwise the alternative at that index. */
  selectedAlternativeIndex: number | null;
  avoidLocations: AvoidLocation[];
  floodZones: FloodZone[];
  weatherAlerts: WeatherAlert[];
  precipitation: PrecipitationPoint[];
  incidents: RoadIncident[];
  routeLandmarks: RouteLandmark[];
  mapPaddingTop?: number;
  onLongPress: (lat: number, lng: number) => void;
  onRemoveAvoidLocation: (id: string) => void;
};

export function RouteMap({
  from,
  to,
  route,
  selectedAlternativeIndex,
  avoidLocations,
  floodZones,
  weatherAlerts,
  precipitation,
  incidents,
  routeLandmarks,
  mapPaddingTop = 96,
  onLongPress,
  onRemoveAvoidLocation,
}: RouteMapProps) {
  const mapRef = useRef<MapView>(null);

  const selectedAlternative =
    route && selectedAlternativeIndex !== null ? route.alternatives[selectedAlternativeIndex] : undefined;

  /** The line the camera frames and the one drawn in the primary colour. */
  const activeCoordinates = useMemo(
    () => (selectedAlternative ? selectedAlternative.coordinates : (route?.coordinates ?? [])),
    [route, selectedAlternative],
  );

  useEffect(() => {
    if (activeCoordinates.length > 1) {
      mapRef.current?.fitToCoordinates(activeCoordinates.map(toLatLng), {
        edgePadding: { top: mapPaddingTop, right: 60, bottom: 260, left: 60 },
        animated: true,
      });
      return;
    }

    if (from && to) {
      mapRef.current?.fitToCoordinates(
        [
          { latitude: from.latitude, longitude: from.longitude },
          { latitude: to.latitude, longitude: to.longitude },
        ],
        { edgePadding: { top: mapPaddingTop, right: 60, bottom: 260, left: 60 }, animated: true },
      );
      return;
    }

    if (from) {
      mapRef.current?.animateToRegion({ ...DEFAULT_REGION, latitude: from.latitude, longitude: from.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 650);
    }
  }, [activeCoordinates, from, mapPaddingTop, to]);

  if (Platform.OS === 'web') {
    return <WebFallback />;
  }

  return (
    <MapView
      ref={mapRef}
      style={styles.mapView}
      initialRegion={DEFAULT_REGION}
      mapPadding={{ top: mapPaddingTop, right: spacing.lg, bottom: spacing.lg, left: spacing.lg }}
      customMapStyle={mapDarkStyle}
      userInterfaceStyle="dark"
      loadingEnabled
      loadingBackgroundColor={mapColors.surfaceContainerLow}
      loadingIndicatorColor={mapColors.primary}
      showsCompass
      showsScale
      zoomEnabled
      scrollEnabled
      rotateEnabled={false}
      pitchEnabled={false}
      onLongPress={(event: LongPressEvent) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;
        onLongPress(latitude, longitude);
      }}
      accessibilityLabel="Route planning map"
    >
      {/* Overlays first: everything below is context the route is read against,
          so it must never paint over the line the user is following. */}
      {weatherAlerts.flatMap((alert) => {
        const style = getWeatherAlertStyle(alert.severity);

        return alert.rings.map((ring, index) => (
          <Polygon
            key={`${alert.id}-${index}`}
            coordinates={ring}
            fillColor={style.fill}
            strokeColor={style.stroke}
            strokeWidth={1}
          />
        ));
      })}

      {floodZones.flatMap((zone) => {
        const style = getFloodZoneStyle(zone.severity);

        return zone.rings.map((ring, index) => (
          <Polygon
            key={`${zone.id}-${index}`}
            coordinates={ring}
            fillColor={style.fill}
            strokeColor={style.stroke}
            strokeWidth={1}
          />
        ));
      })}

      {precipitation.map((point) => {
        const circle = getPrecipitationCircle(point.probability);

        return (
          <Circle
            key={point.id}
            center={{ latitude: point.latitude, longitude: point.longitude }}
            radius={circle.radiusM}
            fillColor={circle.fill}
            strokeColor={circle.stroke}
            strokeWidth={1}
          />
        );
      })}

      {/* Unselected alternatives, dimmed — visible enough to show another way
          exists, quiet enough not to be mistaken for the route in play. */}
      {route
        ? route.alternatives.map((alternative, index) =>
            index === selectedAlternativeIndex ? null : (
              <Polyline
                key={`alternative-${index}`}
                coordinates={alternative.coordinates.map(toLatLng)}
                strokeColor={INACTIVE_ROUTE_STROKE}
                strokeWidth={4}
                lineCap="round"
                lineJoin="round"
              />
            ),
          )
        : null}

      {/* The primary route draws per step so each segment can carry its own
          traffic tint; an alternative arrives as one undifferentiated line. */}
      {selectedAlternative ? (
        <Polyline
          coordinates={selectedAlternative.coordinates.map(toLatLng)}
          strokeColor={mapColors.primary}
          strokeWidth={5}
          lineCap="round"
          lineJoin="round"
        />
      ) : (
        route?.steps.map((step, index) => (
          <Polyline
            key={`step-${index}`}
            coordinates={step.coordinates.map(toLatLng)}
            strokeColor={step.traffic_color ?? mapColors.primary}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        ))
      )}

      {route && selectedAlternativeIndex === null
        ? route.landmarksPassed.map((landmark) => <LandmarkDot key={landmark.slug} landmark={landmark} />)
        : null}

      {incidents.map((incident) => {
        const style = getIncidentStyle(incident.kind, incident.reportCount);

        return (
          <Marker
            key={incident.id}
            coordinate={{ latitude: incident.latitude, longitude: incident.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            title={formatIncidentKind(incident.kind)}
            description={
              incident.reportCount > 1 ? `Confirmed by ${incident.reportCount} people` : 'Reported once'
            }
            accessibilityLabel={`${formatIncidentKind(incident.kind)}, ${
              incident.reportCount > 1 ? `confirmed by ${incident.reportCount} people` : 'reported once'
            }`}
          >
            <View
              style={[
                styles.incidentPin,
                { backgroundColor: style.color },
                style.corroborated && styles.incidentPinCorroborated,
              ]}
            />
          </Marker>
        );
      })}

      {routeLandmarks.map((landmark) => (
        <Marker
          key={`along-${landmark.slug}`}
          coordinate={{ latitude: landmark.latitude, longitude: landmark.longitude }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
          title={landmark.name}
          description={landmark.kind}
          accessibilityLabel={`${landmark.name}, ${landmark.kind}`}
        >
          <View style={styles.alongLandmarkDot} />
        </Marker>
      ))}

      {from ? <EndpointMarker label="A" tone="origin" coordinate={{ latitude: from.latitude, longitude: from.longitude }} /> : null}
      {to ? <EndpointMarker label="B" tone="destination" coordinate={{ latitude: to.latitude, longitude: to.longitude }} /> : null}

      {avoidLocations.map((item) => (
        <AvoidLocationMarker key={item.id} item={item} onRemove={() => onRemoveAvoidLocation(item.id)} />
      ))}
    </MapView>
  );
}

function EndpointMarker({
  label,
  tone,
  coordinate,
}: {
  label: 'A' | 'B';
  tone: 'origin' | 'destination';
  coordinate: LatLng;
}) {
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      accessibilityLabel={tone === 'origin' ? 'Route start' : 'Route end'}
    >
      <View style={[styles.endpointMarker, tone === 'destination' && styles.endpointMarkerDestination]}>
        {tone === 'destination' ? (
          <Flag color={colors.onDanger} size={14} />
        ) : (
          <AppText variant="caption" style={styles.endpointMarkerText}>
            {label}
          </AppText>
        )}
      </View>
    </Marker>
  );
}

function LandmarkDot({ landmark }: { landmark: LandmarkPassed }) {
  const { centroid } = landmark;

  // Nothing to pin without a position — the route itself is unaffected.
  if (!centroid) {
    return null;
  }

  return (
    <Marker
      coordinate={{ latitude: centroid.lat, longitude: centroid.lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      accessibilityLabel={`Passes ${landmark.name}`}
    >
      <View style={styles.landmarkDot} />
    </Marker>
  );
}

function AvoidLocationMarker({ item, onRemove }: { item: AvoidLocation; onRemove: () => void }) {
  return (
    <Marker
      coordinate={{ latitude: item.lat, longitude: item.lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      onPress={onRemove}
      accessibilityLabel={`Avoiding ${item.label}. Tap to remove.`}
    >
      <View style={styles.avoidMarker} />
    </Marker>
  );
}

function WebFallback() {
  return (
    <View style={styles.webFallback} accessible accessibilityLabel="Map preview not available on web">
      <AppText variant="subtitle" tone="faint" align="center">
        Map preview isn't available on web
      </AppText>
      <AppText variant="caption" tone="faint" align="center" style={styles.webFallbackCaption}>
        Open AfriHex on iOS or Android to see the route on the map. Route details still work here.
      </AppText>
    </View>
  );
}

function formatIncidentKind(kind: string) {
  return kind.replace(/_/g, ' ').replace(/^./, (first) => first.toUpperCase());
}

function toLatLng([lng, lat]: [number, number]): LatLng {
  return { latitude: lat, longitude: lng };
}

const styles = StyleSheet.create({
  mapView: {
    flex: 1,
    // The native map surface is white until it paints its first frame, and on a
    // dark screen that reads as the page loading broken rather than loading.
    // Colouring the view underneath it means the gap is the map's own dark
    // background instead.
    backgroundColor: mapColors.surfaceContainerLow,
  },
  webFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: mapColors.surfaceContainerLow,
  },
  webFallbackCaption: {
    maxWidth: 280,
  },
  endpointMarker: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    backgroundColor: mapColors.primary,
    borderWidth: 2,
    borderColor: colors.white,
  },
  endpointMarkerDestination: {
    backgroundColor: mapColors.error,
  },
  endpointMarkerText: {
    // Dark on the green fill (7.3:1); white would measure 2.5:1.
    color: colors.onPrimary,
  },
  landmarkDot: {
    width: 10,
    height: 10,
    borderRadius: radius.round,
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.white,
  },
  /** Distinct from `landmarkDot`: these are places near the route, not on it. */
  alongLandmarkDot: {
    width: 12,
    height: 12,
    borderRadius: radius.round,
    backgroundColor: colors.violet,
    borderWidth: 2,
    borderColor: colors.white,
  },
  incidentPin: {
    width: 14,
    height: 14,
    borderRadius: radius.round,
    borderWidth: 2,
    borderColor: colors.white,
  },
  /** Corroborated reports are the ones routing acts on, so they read heavier. */
  incidentPinCorroborated: {
    width: 20,
    height: 20,
    borderWidth: 3,
  },
  avoidMarker: {
    width: 16,
    height: 16,
    borderRadius: radius.round,
    backgroundColor: mapColors.error,
    borderWidth: 2,
    borderColor: colors.white,
  },
});
