import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Flag,
  Milestone,
  Navigation,
  Signpost,
  Undo2,
  type LucideIcon,
} from 'lucide-react-native';

import { mapRoute } from '../../../constants/material';
import type { ManeuverKind } from '../utils/turnGuidance';

/**
 * One arrow per manoeuvre.
 *
 * The set is deliberately small. A turn-by-turn banner is read at a glance while
 * moving, so a distinct glyph per Valhalla turn class would be a lookup task
 * rather than a recognition one — `merge_left` and `slight_left` do not look
 * meaningfully different from the driver's seat, and rendering them as different
 * arrows would imply a distinction the road does not make.
 *
 * `turnGuidance.getManeuverKind` does the reducing, so this file only maps the
 * result to a shape.
 */
const ICONS: Record<ManeuverKind, LucideIcon> = {
  depart: Navigation,
  straight: ArrowUp,
  slightLeft: ArrowUpLeft,
  slightRight: ArrowUpRight,
  left: ArrowLeft,
  right: ArrowRight,
  /** Sharp turns reuse the left/right arrows; only the U-turn is distinct. */
  sharpLeft: ArrowLeft,
  sharpRight: ArrowRight,
  uturn: Undo2,
  roundabout: Milestone,
  merge: Signpost,
  exit: Signpost,
  arrive: Flag,
  unknown: ArrowUp,
};

type ManeuverIconProps = {
  kind: ManeuverKind;
  size?: number;
  color?: string;
  /**
   * Announced alongside the instruction. A bare arrow is meaningless to a screen
   * reader, so the caller supplies the word rather than this component guessing
   * one from the glyph.
   */
  accessibilityLabel: string;
};

export function ManeuverIcon({ kind, size = 28, color = mapRoute.maneuver, accessibilityLabel }: ManeuverIconProps) {
  const Icon = ICONS[kind];

  return <Icon color={color} size={size} accessible accessibilityLabel={accessibilityLabel} />;
}

const SPOKEN_LABELS: Record<ManeuverKind, string> = {
  depart: 'Starting point',
  straight: 'Continue straight',
  slightLeft: 'Bear left',
  slightRight: 'Bear right',
  left: 'Turn left',
  right: 'Turn right',
  sharpLeft: 'Sharp left',
  sharpRight: 'Sharp right',
  uturn: 'Make a U-turn',
  roundabout: 'Enter the roundabout',
  merge: 'Merge',
  exit: 'Take the exit',
  arrive: 'Arrive at your destination',
  unknown: 'Continue',
};

/** The spoken equivalent of the arrow, for `accessibilityLabel`. */
export function getManeuverSpokenLabel(kind: ManeuverKind) {
  return SPOKEN_LABELS[kind];
}
