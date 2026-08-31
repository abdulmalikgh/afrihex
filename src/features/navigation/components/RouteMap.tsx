import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, type LatLng, type LongPressEvent, type Region } from 'react-native-maps';
import { Flag } from 'lucide-react-native';

import { AppText } from '../../../components';
import { colors } from '../../../constants/colors';
import { mapDarkStyle } from '../../../constants/mapStyle';
import { mapColors } from '../../../constants/material';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import type { LandmarkPassed } from '../../../api/route';
import type { ResolvedFindGpsResult } from '../../../utils/resolveAddressQuery';
import type { PlannedRoute } from '../types/directions';
import type { AvoidLocation } from '../hooks/useAvoidLocations';

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
  avoidLocations: AvoidLocation[];
  mapPaddingTop?: number;
  onLongPress: (lat: number, lng: number) => void;
  onRemoveAvoidLocation: (id: string) => void;
};

export function RouteMap({
  from,
  to,
  route,
  avoidLocations,
  mapPaddingTop = 96,
  onLongPress,
  onRemoveAvoidLocation,
}: RouteMapProps) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (route && route.coordinates.length > 1) {
      const coordinates = route.coordinates.map(toLatLng);
      mapRef.current?.fitToCoordinates(coordinates, {
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
  }, [from, mapPaddingTop, route, to]);

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
      {route
        ? route.steps.map((step, index) => (
            <Polyline
              key={`step-${index}`}
              coordinates={step.coordinates.map(toLatLng)}
              strokeColor={step.traffic_color ?? mapColors.primary}
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          ))
        : null}

      {route
        ? route.landmarksPassed.map((landmark) => <LandmarkDot key={landmark.slug} landmark={landmark} />)
        : null}

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

function toLatLng([lng, lat]: [number, number]): LatLng {
  return { latitude: lat, longitude: lng };
}

const styles = StyleSheet.create({
  mapView: {
    flex: 1,
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
  avoidMarker: {
    width: 16,
    height: 16,
    borderRadius: radius.round,
    backgroundColor: mapColors.error,
    borderWidth: 2,
    borderColor: colors.white,
  },
});
