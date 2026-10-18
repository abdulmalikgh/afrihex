import { StyleSheet, View } from 'react-native';
import { Marker, type LatLng } from 'react-native-maps';

import { colors } from '../../../constants/colors';
import { mapRoute } from '../../../constants/material';
import type { RouteStep } from '../../../api/route';
import { getManeuverKind } from '../utils/turnGuidance';
import { ManeuverIcon, getManeuverSpokenLabel } from './ManeuverIcon';

/**
 * The point on the map where the manoeuvre happens.
 *
 * Anchored to the *start* of a step's geometry. That point is a step boundary
 * under either of the API's two readings of where a manoeuvre sits — see
 * `turnGuidance.buildJunctions` — so it is the one coordinate that means "the
 * junction" without having to settle the question.
 */
type ManeuverMarkerProps = {
  coordinate: LatLng;
  /** The step whose manoeuvre this marks. */
  stepIndex: number;
  steps: RouteStep[];
  /** Renders as the destination flag rather than a turn arrow. */
  isDestination?: boolean;
  /**
   * Must be `true` whenever the arrow can change while the marker stays mounted.
   *
   * `react-native-maps` caches the marker's bitmap on Android when this is
   * `false`, so guidance advancing to a different manoeuvre would leave the
   * previous turn's arrow on screen. It costs a re-render per manoeuvre change,
   * which is a handful of times per trip — not per frame.
   */
  tracksViewChanges?: boolean;
};

export function ManeuverMarker({
  coordinate,
  stepIndex,
  steps,
  isDestination = false,
  tracksViewChanges = false,
}: ManeuverMarkerProps) {
  const step = steps[stepIndex];
  const kind = getManeuverKind(step, { isFirst: stepIndex === 0, isLast: stepIndex === steps.length - 1 });
  const spoken = isDestination ? 'Your destination' : getManeuverSpokenLabel(kind);

  return (
    <Marker
      coordinate={coordinate}
      // Anchored bottom-centre so the badge sits above the junction rather than
      // over it — the pin points at the turn, it does not cover it.
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracksViewChanges}
      accessibilityLabel={spoken}
    >
      <View style={[styles.badge, isDestination && styles.badgeDestination]}>
        <ManeuverIcon
          kind={kind}
          size={18}
          color={isDestination ? colors.onDanger : colors.onPrimary}
          // The Marker's own label already carries this; announcing the inner
          // icon too would read the label twice.
          accessibilityLabel=""
        />
      </View>
      <View style={styles.stem} />
    </Marker>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: mapRoute.maneuver,
    borderWidth: 2,
    borderColor: colors.white,
  },
  /** Matches `RouteMap`'s destination pin, so the two read as the same object. */
  badgeDestination: {
    backgroundColor: colors.danger,
    borderRadius: 4,
  },
  /**
   * The pin's point. Drawn as a rotated square rather than a triangle so it needs
   * no extra asset, and offset so its tip lands on the junction.
   */
  stem: {
    alignSelf: 'center',
    width: 8,
    height: 8,
    marginTop: -5,
    backgroundColor: mapRoute.maneuver,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.white,
    transform: [{ rotate: '45deg' }],
  },
});
