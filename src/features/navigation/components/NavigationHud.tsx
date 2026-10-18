import { Pressable, StyleSheet, View } from 'react-native';
import { Check, Volume2 } from 'lucide-react-native';

import { AppText } from '../../../components';
import { colors } from '../../../constants/colors';
import { mapColors, mapElevation, mapRoute, mapShape } from '../../../constants/material';
import { spacing } from '../../../constants/spacing';
import type { RouteStep } from '../../../api/route';
import type { NavigationPhase } from '../hooks/useTurnByTurn';
import { getManeuverKind, formatGuidanceDistanceLabel } from '../utils/turnGuidance';
import { LaneGuidance } from './LaneGuidance';
import { ManeuverIcon, getManeuverSpokenLabel } from './ManeuverIcon';

type NavigationHudProps = {
  phase: NavigationPhase;
  steps: RouteStep[];
  activeStepIndex: number;
  nextStepIndex: number | null;
  /** The manoeuvre after the next one, when the two are close together. */
  followingStepIndex: number | null;
  distanceToManeuverM: number | null;
  topInset: number;
  message: string | null;
  /** Says the current instruction again. */
  onRepeat: () => void;
  /** Whether repeating would actually be audible, so the hint does not lie. */
  isVoiceAudible: boolean;
};

/**
 * The guidance banner: what to do next, how far away it is, and what follows it.
 *
 * Replaces the directions header during a trip rather than sitting under it — the
 * search fields and mode tabs are for planning, and leaving them on screen during
 * a drive would put the instruction the driver needs behind three rows of controls
 * they have no use for.
 *
 * The trip totals used to live here and now sit in the controls bar at the
 * bottom. Two reasons, both borrowed from Google and Apple: the remaining ETA is
 * a glance-when-idle number rather than an act-on-it one, so it does not belong
 * in the same visual weight class as the manoeuvre; and giving it up freed the
 * full width for the "then" row and the lane strip, which are the two things
 * that actually change what the driver does next.
 *
 * The whole banner is a tap target for repeating the instruction. That is where
 * Apple puts it, and the reasoning holds: the moment you want to hear it again
 * is the moment you have just missed it and are already looking here.
 */
export function NavigationHud({
  phase,
  steps,
  activeStepIndex,
  nextStepIndex,
  followingStepIndex,
  distanceToManeuverM,
  topInset,
  message,
  onRepeat,
  isVoiceAudible,
}: NavigationHudProps) {
  const isArrived = phase === 'arrived';
  const isOffRoute = phase === 'offRoute';
  const nextStep = nextStepIndex === null ? undefined : steps[nextStepIndex];
  const kind = getManeuverKind(nextStep, {
    isFirst: false,
    isLast: nextStepIndex === steps.length - 1,
  });

  const distanceLabel = formatGuidanceDistanceLabel(distanceToManeuverM);
  const instruction = nextStep?.instruction ?? 'Continue to your destination';

  const followingStep = followingStepIndex === null ? undefined : steps[followingStepIndex];
  const followingKind = getManeuverKind(followingStep, {
    isFirst: false,
    isLast: followingStepIndex === steps.length - 1,
  });

  /**
   * Repeating only makes sense while there is a live instruction to repeat.
   * On the terminal phases the banner is a summary, and a tap target that
   * speaks nothing is worse than no tap target.
   */
  const canRepeat = isVoiceAudible && !isArrived && nextStep !== undefined && message === null;

  const headline = isArrived
    ? 'Arrived'
    : phase === 'starting'
      ? 'Finding you…'
      : isOffRoute
        ? 'Off route'
        : (distanceLabel ?? 'Continue');

  const detail = isArrived
    ? destinationReachedCopy
    : isOffRoute
      ? 'Rejoining as soon as you are back on the line'
      : instruction;

  return (
    <Pressable
      accessibilityRole={canRepeat ? 'button' : undefined}
      accessibilityLabel={canRepeat ? `${headline}. ${detail}` : undefined}
      accessibilityHint={canRepeat ? 'Says the instruction again' : undefined}
      disabled={!canRepeat}
      onPress={onRepeat}
      style={({ pressed }) => [
        styles.container,
        { paddingTop: topInset + spacing.sm },
        pressed && canRepeat && styles.pressed,
      ]}
    >
      {message ? (
        <View style={styles.messageRow}>
          <AppText variant="bodyStrong" tone="gold">
            {message}
          </AppText>
        </View>
      ) : (
        <>
          <View style={styles.mainRow}>
            <View style={[styles.iconWell, isArrived && styles.iconWellArrived]}>
              {isArrived ? (
                <Check color={colors.onPrimary} size={30} />
              ) : (
                <ManeuverIcon
                  kind={kind}
                  size={34}
                  color={isOffRoute ? colors.danger : colors.onPrimary}
                  accessibilityLabel={getManeuverSpokenLabel(kind)}
                />
              )}
            </View>

            <View style={styles.text}>
              {/* The distance is the headline and the instruction is the detail.
                  Reversed, the driver has to read past a sentence to find out how
                  far they have to react. */}
              <AppText variant="title" numberOfLines={1}>
                {headline}
              </AppText>
              <AppText variant="body" tone="muted" numberOfLines={2}>
                {detail}
              </AppText>
            </View>

            {/* A standing affordance rather than a hint that appears and goes:
                the driver has to know it is tappable *before* they miss the
                instruction, not after. */}
            {canRepeat ? (
              <View style={styles.repeatBadge}>
                <Volume2 color={mapColors.onSurfaceVariant} size={16} />
              </View>
            ) : null}
          </View>

          {/*
            The visual half of the chained announcement. Shown only when the
            voice treated the pair as one instruction, so what is read and what
            was said never disagree — a "then" row for a turn 2 km away is a
            distraction, which is why this is driven by the chain decision rather
            than by "is there a step after this one".
          */}
          {followingStep && !isArrived && !isOffRoute ? (
            <View style={styles.thenRow}>
              <AppText variant="overline" tone="faint">
                Then
              </AppText>
              <ManeuverIcon
                kind={followingKind}
                size={18}
                color={mapColors.onSurfaceVariant}
                accessibilityLabel={getManeuverSpokenLabel(followingKind)}
              />
              <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.thenText}>
                {followingStep.instruction}
              </AppText>
            </View>
          ) : null}

          {nextStep?.lanes && !isArrived && !isOffRoute ? <LaneGuidance lanes={nextStep.lanes} /> : null}

          {/* Where the trip is, for a glance after a long straight. */}
          {phase !== 'starting' && !isArrived ? (
            <AppText variant="caption" tone="faint" numberOfLines={1}>
              Step {Math.min(activeStepIndex + 1, steps.length)} of {steps.length}
            </AppText>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

/** Named rather than inlined so both the HUD and the sheet can stay in step. */
const destinationReachedCopy = 'You are here. Tap Done when you are parked.';

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: mapColors.surface,
    borderBottomLeftRadius: mapShape.large,
    borderBottomRightRadius: mapShape.large,
    borderBottomWidth: 1,
    borderColor: colors.border,
    ...mapElevation.level3,
  },
  pressed: {
    opacity: 0.9,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  messageRow: {
    paddingVertical: spacing.sm,
  },
  iconWell: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: mapShape.medium,
    // Dark on the manoeuvre green (7.4:1). The well is filled rather than
    // outlined because the arrow has to be readable in peripheral vision.
    backgroundColor: mapRoute.maneuver,
  },
  /** Arrival is not a manoeuvre, so the well drops the "act now" green. */
  iconWellArrived: {
    backgroundColor: mapColors.primary,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  /**
   * Decoration, not a control — the whole banner is the target, so sizing this
   * to 44pt would imply a second, smaller hit area inside the first.
   */
  repeatBadge: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: mapShape.full,
    backgroundColor: mapColors.surfaceContainerHigh,
  },
  thenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: mapColors.outlineVariant,
  },
  thenText: {
    flex: 1,
    minWidth: 0,
  },
});
