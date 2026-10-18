import { StyleSheet, View } from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Undo2,
  type LucideIcon,
} from 'lucide-react-native';

import { colors } from '../../../constants/colors';
import { mapColors, mapRoute, mapShape } from '../../../constants/material';
import { spacing } from '../../../constants/spacing';
import type { RouteLane } from '../../../api/route';

/**
 * Which lanes to be in for the upcoming manoeuvre.
 *
 * Genuinely rare — most Ghana roads carry no `turn:lanes` tagging at all — so
 * this renders nothing unless the step came back with lanes *and* at least one
 * of them is marked active. A strip of five identical grey arrows tells the
 * driver nothing and costs the banner a row it needs for the instruction.
 *
 * The arrows are drawn from the lane's own indications rather than from the
 * manoeuvre, because the two are not the same question: the manoeuvre is where
 * the driver is going, the lane is what each lane permits.
 */
const INDICATION_ICONS: Record<string, LucideIcon> = {
  left: ArrowLeft,
  'slight left': ArrowUpLeft,
  'sharp left': ArrowLeft,
  right: ArrowRight,
  'slight right': ArrowUpRight,
  'sharp right': ArrowRight,
  straight: ArrowUp,
  through: ArrowUp,
  uturn: Undo2,
  'u-turn': Undo2,
};

type LaneGuidanceProps = {
  lanes: RouteLane[];
};

export function LaneGuidance({ lanes }: LaneGuidanceProps) {
  if (lanes.length === 0 || !lanes.some((lane) => lane.active)) {
    return null;
  }

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={buildLaneLabel(lanes)}
    >
      {lanes.map((lane, index) => (
        <View
          // Lanes have no identity of their own and their order *is* their
          // meaning — the leftmost lane is the leftmost lane.
          key={index}
          style={[styles.lane, lane.active ? styles.laneActive : styles.laneInactive]}
        >
          {resolveIndications(lane).map((Icon, iconIndex) => (
            <Icon
              key={iconIndex}
              size={16}
              color={lane.active ? colors.onPrimary : mapColors.onSurfaceVariant}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * At most two arrows per lane. A lane tagged `left;through;right` is a lane that
 * permits everything, and drawing three arrows in a 32pt box produces a smudge
 * at the size this is read from.
 */
function resolveIndications(lane: RouteLane): LucideIcon[] {
  const icons = lane.indications
    .map((indication) => INDICATION_ICONS[indication.toLowerCase().replace(/_/g, ' ')])
    .filter((icon): icon is LucideIcon => icon !== undefined);

  // `none` and untagged lanes both arrive empty, and a blank box reads as a
  // rendering failure rather than as a lane that goes straight on.
  return icons.length === 0 ? [ArrowUp] : icons.slice(0, 2);
}

/**
 * One label for the whole strip rather than one per lane: a screen reader
 * walking eight lane boxes is worse than no lane guidance at all, and the only
 * thing the user needs is which of them to be in.
 */
function buildLaneLabel(lanes: RouteLane[]) {
  const positions = lanes
    .map((lane, index) => (lane.active ? index + 1 : null))
    .filter((position): position is number => position !== null);

  if (positions.length === lanes.length) {
    return 'Any lane';
  }

  const ordinals = positions.map((position) => ordinal(position));
  const joined =
    ordinals.length > 1 ? `${ordinals.slice(0, -1).join(', ')} or ${ordinals[ordinals.length - 1]}` : ordinals[0];

  return `Use the ${joined} lane from the left, of ${lanes.length}`;
}

function ordinal(value: number) {
  if (value === 1) {
    return 'first';
  }

  if (value === 2) {
    return 'second';
  }

  if (value === 3) {
    return 'third';
  }

  return `${value}th`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  lane: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    minWidth: 32,
    height: 28,
    paddingHorizontal: spacing.xs,
    borderRadius: mapShape.small,
  },
  /** The manoeuvre green, same as the icon well — this is the "act on it" role. */
  laneActive: {
    backgroundColor: mapRoute.maneuver,
  },
  /**
   * Present but not competing. Outlined rather than filled so the active lanes
   * are the only thing in the strip carrying weight.
   */
  laneInactive: {
    borderWidth: 1,
    borderColor: mapColors.outlineVariant,
  },
});
