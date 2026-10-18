import { Pressable, StyleSheet, View } from 'react-native';
import { Check, TriangleAlert, Volume1, Volume2, VolumeX, X } from 'lucide-react-native';

import { AppText } from '../../../components';
import { colors } from '../../../constants/colors';
import { mapColors, mapElevation, mapShape } from '../../../constants/material';
import { spacing } from '../../../constants/spacing';
import type { NavigationPhase } from '../hooks/useTurnByTurn';
import { formatDuration } from '../utils/directionsFormatting';
import { VERBOSITY_LABELS, type GuidanceVerbosity } from '../utils/speech';

type NavigationControlsProps = {
  phase: NavigationPhase;
  verbosity: GuidanceVerbosity;
  /** True while the trip is being tracked by a background task. */
  isBackgroundTracked: boolean;
  remainingM: number;
  remainingS: number;
  bottomInset: number;
  onStop: () => void;
  /** Clears an arrived or failed trip. Reports nothing. */
  onDismiss: () => void;
  onCycleVerbosity: () => void;
};

/**
 * Phases where there is no trip to end, so `onStop` would do nothing and the
 * user would be tapping a dead button. Each of these has already been reported —
 * or is never going to be.
 */
const TERMINAL_PHASES: ReadonlySet<string> = new Set(['arrived', 'denied', 'error']);

const VERBOSITY_ICONS = {
  full: Volume2,
  essential: Volume1,
  muted: VolumeX,
} as const;

/**
 * The controls for a trip in progress, and the trip's totals.
 *
 * Sits where the results sheet was, and like the HUD replaces it rather than
 * stacking on it — the step list is a planning artefact, and a driver mid-junction
 * does not need a scrollable list of instructions they are already being given.
 *
 * The totals moved down here from the banner, which is where both Google and
 * Apple keep them. They are a reassurance number, not an instruction, and the
 * banner needed the width for the "then" row.
 */
export function NavigationControls({
  phase,
  verbosity,
  isBackgroundTracked,
  remainingM,
  remainingS,
  bottomInset,
  onStop,
  onDismiss,
  onCycleVerbosity,
}: NavigationControlsProps) {
  // Arrival and failure share a layout because they share a truth: there is no
  // trip to end. Only the copy differs, and the HUD above carries the reason.
  if (TERMINAL_PHASES.has(phase)) {
    const isArrival = phase === 'arrived';

    return (
      <View style={[styles.container, { paddingBottom: bottomInset + spacing.md }]}>
        <View style={styles.arrivedRow}>
          {isArrival ? (
            <View style={styles.arrivedBadge}>
              <Check color={colors.onPrimary} size={20} />
            </View>
          ) : (
            <View style={styles.failedBadge}>
              <TriangleAlert color={colors.gold} size={20} />
            </View>
          )}
          <AppText variant="bodyStrong">{isArrival ? 'You have arrived' : 'Guidance not started'}</AppText>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isArrival ? 'Done' : 'Close'}
          accessibilityHint="Closes guidance and returns to route planning"
          onPress={onDismiss}
          style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
        >
          <AppText variant="bodyStrong" style={styles.doneLabel}>
            {isArrival ? 'Done' : 'Close'}
          </AppText>
        </Pressable>
      </View>
    );
  }

  const VolumeIcon = VERBOSITY_ICONS[verbosity];

  return (
    <View style={[styles.container, { paddingBottom: bottomInset + spacing.md }]}>
      {/*
        One line, read left to right the way the question is asked: how long,
        how far, and what time that puts me there. The clock time is the one both
        reference apps lead with, because "25 min" has to be added to something
        before it answers anything.
      */}
      <View style={styles.totalsRow}>
        <AppText variant="bodyStrong">{formatDuration(remainingS)}</AppText>
        <AppText variant="caption" tone="faint">
          {formatRemainingDistance(remainingM)}
        </AppText>
        <AppText variant="caption" tone="muted">
          {formatArrivalClock(remainingS)}
        </AppText>

        {/* Only when it is not the default. Labelling "Full voice" during a trip
            where the voice is plainly working is noise; labelling a voice that
            has been turned down is the difference between a deliberate setting
            and a trip the driver thinks is broken. */}
        {verbosity === 'full' ? null : (
          <AppText variant="caption" tone="gold" style={styles.verbosityNote}>
            {VERBOSITY_LABELS[verbosity]}
          </AppText>
        )}
      </View>

      {/*
        End is the widest target and sits on the edge under the thumb. The voice
        button is a 56pt square beside it rather than an icon in the banner,
        because turning the voice down is something a driver does by feel,
        mid-trip, without looking.
      */}
      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="End navigation"
          accessibilityHint="Stops guidance and returns to route planning"
          onPress={onStop}
          style={({ pressed }) => [styles.endButton, pressed && styles.pressed]}
        >
          <X color={colors.onDanger} size={20} />
          <AppText variant="bodyStrong" style={styles.endLabel}>
            End
          </AppText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voice guidance"
          accessibilityValue={{ text: VERBOSITY_LABELS[verbosity] }}
          accessibilityHint="Switches between full voice, turns only, and off"
          onPress={onCycleVerbosity}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <VolumeIcon color={verbosity === 'muted' ? mapColors.onSurfaceVariant : mapColors.primary} size={22} />
        </Pressable>
      </View>

      {/*
        Stated rather than implied: without this the user cannot tell whether
        ending the trip here still records where they ended up, and that
        difference only becomes visible once they have locked the phone.
      */}
      {isBackgroundTracked ? (
        <AppText variant="caption" tone="faint">
          Your trip keeps recording if you lock the phone
        </AppText>
      ) : null}
    </View>
  );
}

function formatRemainingDistance(remainingM: number) {
  if (remainingM >= 1000) {
    return `${(remainingM / 1000).toFixed(1)} km`;
  }

  return `${Math.round(remainingM / 10) * 10} m`;
}

/**
 * The clock time the remaining duration lands on.
 *
 * Rendered with the device's own locale and 12/24-hour preference rather than a
 * hand-rolled format, because getting that wrong is immediately obvious and the
 * platform already knows the answer.
 */
function formatArrivalClock(remainingS: number) {
  const arrival = new Date(Date.now() + Math.max(0, remainingS) * 1000);

  return arrival.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: mapColors.surface,
    borderTopLeftRadius: mapShape.large,
    borderTopRightRadius: mapShape.large,
    borderTopWidth: 1,
    borderColor: colors.border,
    ...mapElevation.level3,
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  /** Pushed to the far edge so it reads as a status, not as another total. */
  verbosityNote: {
    marginLeft: 'auto',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  endButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    // Comfortably past the 44pt minimum in both axes: this is the control most
    // likely to be hit without looking at it.
    minHeight: 56,
    borderRadius: mapShape.medium,
    backgroundColor: colors.danger,
  },
  /** Dark on the danger fill — 5.8:1, where white would only reach 3.1:1. */
  endLabel: {
    color: colors.onDanger,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    // Matches the End button's height rather than the 44pt floor, so the pair
    // reads as one row of controls.
    width: 56,
    height: 56,
    borderRadius: mapShape.full,
    backgroundColor: mapColors.surfaceContainerHigh,
  },
  pressed: {
    opacity: 0.8,
  },
  arrivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  arrivedBadge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: mapShape.full,
    backgroundColor: mapColors.primary,
  },
  /** Outline rather than a fill: a failed start has nothing to celebrate. */
  failedBadge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: mapShape.full,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  doneButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: mapShape.medium,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: mapColors.surfaceContainerHigh,
  },
  /** Dark on the container fill; the brand green here would imply an action. */
  doneLabel: {
    color: mapColors.onSurface,
  },
});
