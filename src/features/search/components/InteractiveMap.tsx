import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { MapPin } from 'lucide-react-native';

import { mapColors, mapElevation, mapShape } from '../../../constants/material';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { AppText } from '../../../components';
import type { ResolvedFindGpsResult } from '../hooks/useFindGpsSearch';

type InteractiveMapProps = {
  result: ResolvedFindGpsResult | null;
  style?: StyleProp<ViewStyle>;
  /** Top padding reserved on the map itself so the marker stays clear of the floating search bar. */
  mapPaddingTop?: number;
  /** Bottom padding so the marker stays clear of the sheet. */
  mapPaddingBottom?: number;
  /**
   * Draws the blue user dot. Only enable once foreground permission is granted —
   * setting it beforehand makes the OS prompt at an unexplained moment.
   */
  showsUserLocation?: boolean;
  /**
   * Fires while the user drags the map. Google Maps drops its sheet back to the
   * peek on this, so the map the user reached for is actually visible.
   */
  onPanDrag?: () => void;
  /**
   * Where to point the camera before anything has been searched — the device's
   * own position, once it is known. Google Maps opens on the user's street, not
   * on the country.
   */
  focus?: MapCoordinate | null;
};

export function InteractiveMap({
  result,
  style,
  mapPaddingTop = 96,
  mapPaddingBottom = 0,
  showsUserLocation = false,
  onPanDrag,
  focus = null,
}: InteractiveMapProps) {
  const mapRef = useRef<MapView>(null);
  const region = getMapRegion(result, focus);

  useEffect(() => {
    if (!result) {
      return;
    }

    mapRef.current?.animateToRegion(getMapRegion(result, null), 650);
  }, [result]);

  // A late location fix should still pull the camera in, but never over a result
  // the user is actually looking at.
  useEffect(() => {
    if (result || !focus) {
      return;
    }

    mapRef.current?.animateToRegion(getMapRegion(null, focus), 650);
  }, [focus, result]);

  if (Platform.OS === 'web') {
    return (
      <View style={style}>
        <MapFallback result={result} />
      </View>
    );
  }

  return (
    <MapView
      ref={mapRef}
      style={[styles.mapView, style]}
      initialRegion={region}
      mapPadding={{ top: mapPaddingTop, right: spacing.lg, bottom: mapPaddingBottom, left: spacing.lg }}
      loadingEnabled
      loadingBackgroundColor={mapColors.surfaceContainerLow}
      loadingIndicatorColor={mapColors.primary}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      showsCompass
      showsScale
      zoomEnabled
      scrollEnabled
      rotateEnabled={false}
      pitchEnabled={false}
      onPanDrag={onPanDrag}
      accessibilityLabel="Interactive location map"
    >
      {result ? (
        <Marker
          coordinate={{
            latitude: result.latitude,
            longitude: result.longitude,
          }}
          tracksViewChanges={false}
          // Sit the pin's base on the coordinate instead of the view's centre, so
          // the code bubble floats clear above it. Centred, the bubble lands right
          // on the point and collides with the blue user dot whenever the result
          // is the user's own location. `centerOffset` is the iOS spelling of the
          // same idea, roughly half the marker's height.
          anchor={{ x: 0.5, y: 1 }}
          centerOffset={{ x: 0, y: -32 }}
          accessibilityLabel={`Address code ${result.gpsCode}`}
        >
          <View style={styles.markerWrap}>
            <View style={styles.markerBubble}>
              <AppText variant="code" numberOfLines={1} style={styles.markerCode}>
                {result.gpsCode}
              </AppText>
            </View>
            <View style={styles.markerPin}>
              <MapPin color={mapColors.onPrimary} fill={mapColors.primary} size={20} />
            </View>
          </View>
        </Marker>
      ) : null}
    </MapView>
  );
}

function MapFallback({ result }: { result: ResolvedFindGpsResult | null }) {
  return (
    <View style={styles.mapPreview} accessible accessibilityLabel="Map preview">
      <View style={[styles.landMass, styles.landMassOne]} />
      <View style={[styles.landMass, styles.landMassTwo]} />
      <View style={[styles.landMass, styles.landMassThree]} />
      <View style={[styles.water, styles.waterOne]} />
      <View style={[styles.water, styles.waterTwo]} />
      <View style={styles.mapGrid} />
      <AppText variant="title" style={styles.countryLabel}>
        GHANA
      </AppText>
      <AppText variant="caption" style={styles.cityLabel}>
        Accra
      </AppText>
      <AppText variant="caption" style={styles.osmLabel}>
        OpenStreetMap
      </AppText>
      {result ? (
        <View style={styles.pinWrap}>
          <MapPin color={mapColors.onPrimary} fill={mapColors.primary} size={30} />
        </View>
      ) : null}
    </View>
  );
}

type MapCoordinate = { latitude: number; longitude: number };

/** Accra, for when there is neither a result nor a location fix to centre on. */
const FALLBACK_CENTRE: MapCoordinate = { latitude: 5.6037, longitude: -0.187 };
/** Tight on a resolved address — building scale. */
const RESULT_DELTA = 0.006;
/** Around the user — a few streets, the scale Google Maps opens at. */
const FOCUS_DELTA = 0.02;
/**
 * Last resort. Still city scale, not country scale: below roughly this zoom the
 * tiles carry no street, town or landmark labels, which is why a country-wide
 * delta renders as a bare coastline.
 */
const FALLBACK_DELTA = 0.08;

function getMapRegion(result: ResolvedFindGpsResult | null, focus: MapCoordinate | null): Region {
  const centre = result ?? focus ?? FALLBACK_CENTRE;
  const delta = result ? RESULT_DELTA : focus ? FOCUS_DELTA : FALLBACK_DELTA;

  return {
    latitude: centre.latitude,
    longitude: centre.longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

const styles = StyleSheet.create({
  mapView: {
    flex: 1,
  },
  mapPreview: {
    flex: 1,
    backgroundColor: '#cfdec9',
  },
  markerWrap: {
    alignItems: 'center',
  },
  markerBubble: {
    maxWidth: 160,
    borderRadius: mapShape.small,
    backgroundColor: mapColors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    ...mapElevation.level2,
  },
  markerCode: {
    color: mapColors.onSurface,
  },
  markerPin: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    borderRadius: mapShape.full,
    backgroundColor: mapColors.primary,
    borderWidth: 2,
    borderColor: mapColors.onPrimary,
    ...mapElevation.level2,
  },
  landMass: {
    position: 'absolute',
    backgroundColor: '#e5ead7',
    opacity: 0.9,
  },
  landMassOne: {
    top: 34,
    left: -28,
    width: 240,
    height: 190,
    borderRadius: 90,
    transform: [{ rotate: '-18deg' }],
  },
  landMassTwo: {
    top: 70,
    right: -45,
    width: 250,
    height: 230,
    borderRadius: 120,
    transform: [{ rotate: '12deg' }],
  },
  landMassThree: {
    bottom: 60,
    left: 80,
    width: 210,
    height: 140,
    borderRadius: 80,
    transform: [{ rotate: '22deg' }],
  },
  water: {
    position: 'absolute',
    backgroundColor: '#70d1dc',
    opacity: 0.95,
  },
  waterOne: {
    left: -40,
    right: -40,
    bottom: -45,
    height: 120,
    borderTopLeftRadius: 170,
    borderTopRightRadius: 120,
  },
  waterTwo: {
    top: 124,
    left: '48%',
    width: 64,
    height: 112,
    borderRadius: 32,
    transform: [{ rotate: '-28deg' }],
  },
  mapGrid: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: 'rgba(93, 111, 96, 0.18)',
  },
  countryLabel: {
    position: 'absolute',
    top: 165,
    left: '42%',
    color: 'rgba(76, 86, 87, 0.42)',
  },
  cityLabel: {
    position: 'absolute',
    bottom: 80,
    left: '54%',
    color: 'rgba(76, 86, 87, 0.62)',
  },
  osmLabel: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.sm,
    borderRadius: radius.round,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    color: '#4b514d',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pinWrap: {
    position: 'absolute',
    top: '47%',
    left: '53%',
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.round,
    backgroundColor: mapColors.surface,
  },
});
