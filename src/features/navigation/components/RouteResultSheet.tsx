import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Check,
  Flag,
  Megaphone,
  Milestone,
  Navigation,
  Share2,
  Signpost,
  TriangleAlert,
  Volume2,
  Waves,
} from 'lucide-react-native';

import { AppButton, AppText, EmptyState, ErrorBanner, LoadingState } from '../../../components';
import { colors } from '../../../constants/colors';
import { mapColors, mapRoute } from '../../../constants/material';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { formatDistance } from '../../../utils/landmarkKinds';
import type { RouteAlternative } from '../../../api/route';
import type { DirectionsState, PlannedRoute } from '../types/directions';
import { formatDuration } from '../utils/directionsFormatting';
import { repeatGuidance } from '../utils/speech';

type RouteResultSheetProps = {
  state: DirectionsState;
  /** `null` is the primary route; a number indexes into `route.alternatives`. */
  selectedAlternativeIndex: number | null;
  onSelectAlternative: (index: number | null) => void;
  onShare: () => void;
  onReportArrival: () => void;
  hasReportedArrival: boolean;
  /** Human label for the selected travel mode, e.g. "Drive". */
  modeLabel: string;
  hasOrigin: boolean;
  hasDestination: boolean;
  /** Data saver is on, so the response deliberately carries no steps. */
  isLiteRoute: boolean;
  /** The step pinned on the map, or `null` when nothing is highlighted. */
  selectedStepIndex: number | null;
  onSelectStep: (index: number | null) => void;
  onStartNavigation: () => void;
};

export function RouteResultSheet({
  state,
  selectedAlternativeIndex,
  onSelectAlternative,
  onShare,
  onReportArrival,
  hasReportedArrival,
  modeLabel,
  hasOrigin,
  hasDestination,
  isLiteRoute,
  selectedStepIndex,
  onSelectStep,
  onStartNavigation,
}: RouteResultSheetProps) {
  /**
   * Nothing has been planned yet — which is also what the user sees after
   * tapping a travel mode with no destination set. Saying so, and naming the
   * mode back to them, is the difference between "that button is broken" and
   * "that button worked and is waiting on me".
   */
  if (state.status === 'idle') {
    return (
      <EmptyState
        title={`${modeLabel} route`}
        description={getIdleGuidance({ hasOrigin, hasDestination, modeLabel })}
      />
    );
  }

  if (state.status === 'loading') {
    return <LoadingState label="Planning your route" />;
  }

  if (state.status === 'error') {
    return <ErrorBanner message={state.message} />;
  }

  if (state.status === 'noRoute') {
    return (
      <EmptyState
        title="No route found"
        description="AfriHex couldn't find a route between these points. Try a different mode or points closer to a road."
      />
    );
  }

  const { route } = state;
  const selected = selectedAlternativeIndex !== null ? route.alternatives[selectedAlternativeIndex] : null;
  // Badges describe whichever line is actually drawn: an alternative carries its
  // own flood and surface figures, and showing the primary's beside it would
  // describe a route the user is no longer looking at.
  const badges = selected ? getAlternativeBadges(selected) : getBadges(route);
  const summaryEtaS = selected ? selected.eta_s : route.etaS;
  const summaryDistanceM = selected ? selected.distance_m : route.distanceM;
  // Only landmarks with a live promotion; the field is empty outside its window.
  const promotions = selected ? [] : route.landmarksPassed.filter((landmark) => landmark.promotion_text);
  /**
   * Guidance needs both the steps and the primary line to be the one on screen.
   *
   * A lite route has no steps, and an alternative is drawn as one undivided
   * polyline with no per-step geometry — offering to navigate either would
   * promise turn-by-turn along a line we cannot split at a junction.
   */
  const canNavigate = !isLiteRoute && !selected && route.steps.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryPrimary}>
          <AppText variant="title">{formatDuration(summaryEtaS)}</AppText>
          <AppText variant="caption" tone="muted">
            {formatDistance(summaryDistanceM)}
            {selected ? '' : ` · ${route.trafficNote}`}
          </AppText>
        </View>

        <View style={styles.summaryActions}>
          <SheetAction label="Share" icon={<Share2 color={mapColors.onSurface} size={18} />} onPress={onShare} />
          <SheetAction
            label={hasReportedArrival ? 'Arrival sent' : "I'm here"}
            icon={
              hasReportedArrival ? (
                <Check color={mapColors.primary} size={18} />
              ) : (
                <Flag color={mapColors.onSurface} size={18} />
              )
            }
            onPress={onReportArrival}
            disabled={hasReportedArrival}
          />
        </View>
      </View>

      {/* Above the fold deliberately: this is the action the sheet exists to
          offer, and the steps below it can be a long scroll on a city route. */}
      {canNavigate ? (
        <AppButton
          icon={<Navigation color={colors.onPrimary} size={18} />}
          accessibilityLabel={`Start ${modeLabel.toLowerCase()} guidance`}
          accessibilityHint="AfriHex will guide you with spoken turn-by-turn directions"
          onPress={onStartNavigation}
        >
          Navigate
        </AppButton>
      ) : null}

      {badges.length > 0 ? (
        <View style={styles.badgeRow}>
          {badges.map((badge) => (
            <Badge key={badge.key} tone={badge.tone} icon={badge.icon}>
              {badge.label}
            </Badge>
          ))}
        </View>
      ) : null}

      {route.warnings.length > 0 ? (
        <View style={styles.warningsList}>
          {route.warnings.map((warning) => (
            <View key={warning} style={styles.warningRow}>
              <TriangleAlert color={colors.gold} size={16} />
              <AppText variant="caption" style={styles.warningText}>
                {warning}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      {route.alternatives.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="subtitle">Routes</AppText>

          <RouteOption
            label={`${formatDuration(route.etaS)} · ${formatDistance(route.distanceM)}`}
            caption={route.trafficNote}
            isSelected={selectedAlternativeIndex === null}
            isRecommended={route.recommended}
            onPress={() => onSelectAlternative(null)}
          />

          {route.alternatives.map((alternative, index) => (
            <RouteOption
              key={index}
              label={`${formatDuration(alternative.eta_s)} · ${formatDistance(alternative.distance_m)}`}
              caption={alternative.recommend_reason ?? alternative.rain_note}
              isSelected={selectedAlternativeIndex === index}
              isRecommended={alternative.recommended === true}
              onPress={() => onSelectAlternative(index)}
            />
          ))}
        </View>
      ) : null}

      {promotions.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="subtitle">Along the way</AppText>
          {/* Kept as its own row rather than folded into the turn instruction:
              the API carries it beside the landmark name precisely so the client
              decides when to say it. */}
          {promotions.map((landmark) => (
            <View key={landmark.slug} style={styles.promotionRow}>
              <Megaphone color={colors.gold} size={16} />
              <View style={styles.promotionText}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {landmark.name}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {landmark.promotion_text}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText variant="subtitle">Steps</AppText>

        {/* Alternatives come back as a polyline and a summary — the API carries
            no per-step breakdown for them — so rather than show the main route's
            turns under an alternative's heading, say where the turns live. */}
        {isLiteRoute ? (
          <AppText variant="caption" tone="muted">
            Turn-by-turn steps are off while “Use less data” is on. Switch it off in the route options menu
            to get them back.
          </AppText>
        ) : selected ? (
          <AppText variant="caption" tone="muted">
            Turn-by-turn steps are only available for the main route. Select it above to read them.
          </AppText>
        ) : (
          route.steps.map((step, index) => {
            const isSelected = index === selectedStepIndex;

            return (
              <Pressable
                key={index}
                accessibilityRole="button"
                accessibilityLabel={step.instruction}
                accessibilityHint="Highlights this turn on the map"
                accessibilityState={{ selected: isSelected }}
                onPress={() => onSelectStep(isSelected ? null : index)}
                style={({ pressed }) => [
                  styles.stepRow,
                  isSelected && styles.stepRowSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.stepDot,
                    step.traffic_color ? { backgroundColor: step.traffic_color } : null,
                    isSelected && styles.stepDotSelected,
                  ]}
                />
                <View style={styles.stepText}>
                  <View style={styles.stepInstructionRow}>
                    <AppText variant="body" style={styles.stepInstruction}>
                      {step.instruction}
                    </AppText>
                    {/* Lets a driver hear a turn without leaving the list or
                        starting a trip. Goes through `repeatGuidance` rather
                        than the guidance path because this is a direct request:
                        it interrupts whatever is playing and is not subject to
                        the verbosity filter. Muting still silences it. */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Read aloud: ${step.verbal_instruction ?? step.instruction}`}
                      accessibilityHint="Speaks this turn"
                      hitSlop={8}
                      onPress={() => repeatGuidance(step.verbal_instruction ?? step.instruction)}
                      style={({ pressed }) => [styles.stepSpeak, pressed && styles.pressed]}
                    >
                      <Volume2 color={mapColors.onSurfaceVariant} size={16} />
                    </Pressable>
                  </View>
                  {step.instruction_landmark ? (
                    <AppText variant="caption" tone="muted">
                      {step.instruction_landmark}
                    </AppText>
                  ) : null}
                  <AppText variant="caption" tone="faint">
                    {formatDistance(step.distance_m)}
                  </AppText>

                  {/* Lane tagging exists on very few Ghanaian roads, so this is a
                      bonus on the steps that have it rather than a row the
                      instruction waits for. */}
                  {step.lanes && step.lanes.length > 0 ? (
                    <View style={styles.laneRow}>
                      {step.lanes.map((lane, laneIndex) => (
                        <View
                          key={laneIndex}
                          style={[styles.lane, lane.active && styles.laneActive]}
                          accessibilityLabel={`${lane.indications.join(' or ') || 'lane'}${
                            lane.active ? ', use this lane' : ''
                          }`}
                        >
                          <AppText variant="caption" tone={lane.active ? 'primary' : 'faint'}>
                            {formatLane(lane.indications)}
                          </AppText>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}

/** Arrows rather than words: a lane strip is read at a glance, not parsed. */
function formatLane(indications: string[]) {
  const glyphs: Record<string, string> = {
    left: '←',
    right: '→',
    straight: '↑',
    slight_left: '↖',
    slight_right: '↗',
    sharp_left: '↰',
    sharp_right: '↱',
    uturn: '↺',
  };

  return indications.map((indication) => glyphs[indication] ?? '•').join('') || '•';
}

function getIdleGuidance({
  hasOrigin,
  hasDestination,
  modeLabel,
}: {
  hasOrigin: boolean;
  hasDestination: boolean;
  modeLabel: string;
}) {
  const mode = modeLabel.toLowerCase();

  if (!hasOrigin && !hasDestination) {
    return `Add a start and a destination above, and the ${mode} route appears here.`;
  }

  if (!hasDestination) {
    return `Add a destination above to see the ${mode} route.`;
  }

  return `Add a start point — or tap the location button — to see the ${mode} route.`;
}

function SheetAction({
  label,
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.sheetAction, pressed && styles.pressed, disabled && styles.actionDisabled]}
    >
      {icon}
      <AppText variant="caption">{label}</AppText>
    </Pressable>
  );
}

function RouteOption({
  label,
  caption,
  isSelected,
  isRecommended,
  onPress,
}: {
  label: string;
  caption?: string;
  isSelected: boolean;
  isRecommended: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={caption}
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.alternativeRow,
        isSelected && styles.alternativeRowSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.alternativeText}>
        <AppText variant="bodyStrong">{label}</AppText>
        {caption ? (
          <AppText variant="caption" tone="muted">
            {caption}
          </AppText>
        ) : null}
      </View>

      {isRecommended ? (
        <Badge tone="primary" icon={<Milestone color={colors.primaryLight} size={14} />}>
          Recommended
        </Badge>
      ) : null}

      {/* A check, not just the border tint — selection must survive a user who
          cannot separate the two greens. */}
      {isSelected ? <Check color={mapColors.primary} size={18} /> : null}
    </Pressable>
  );
}

type BadgeTone = 'danger' | 'warning' | 'primary';

function Badge({ tone, icon, children }: { tone: BadgeTone; icon: ReactNode; children: ReactNode }) {
  return (
    <View style={[styles.badge, badgeToneStyles[tone]]}>
      {icon}
      <AppText variant="caption" tone={tone === 'danger' ? 'danger' : tone === 'primary' ? 'primary' : 'gold'}>
        {children}
      </AppText>
    </View>
  );
}

function getBadges(route: PlannedRoute) {
  const badges: Array<{ key: string; label: string; tone: BadgeTone; icon: ReactNode }> = [];

  if (route.floodAvoidanceFailed) {
    badges.push({
      key: 'flood-avoidance-failed',
      label: 'Flood zones could not be avoided',
      tone: 'danger',
      icon: <Waves color={colors.danger} size={14} />,
    });
  }

  if (typeof route.floodCrossings === 'number' && route.floodCrossings > 0) {
    badges.push({
      key: 'flood-crossings',
      label: `Crosses ${route.floodCrossings} flood-prone area${route.floodCrossings > 1 ? 's' : ''}`,
      tone: 'warning',
      icon: <Waves color={colors.gold} size={14} />,
    });
  }

  if (typeof route.incidentCount === 'number' && route.incidentCount > 0) {
    badges.push({
      key: 'incidents',
      label: `${route.incidentCount} hazard report${route.incidentCount > 1 ? 's' : ''} on the way`,
      tone: 'warning',
      icon: <TriangleAlert color={colors.gold} size={14} />,
    });
  }

  if (route.hasUnpaved === 'yes') {
    const distance = typeof route.unpavedDistanceM === 'number' ? formatDistance(route.unpavedDistanceM) : null;
    badges.push({
      key: 'unpaved',
      label: distance ? `Unpaved · ${distance}` : 'Includes unpaved road',
      tone: 'warning',
      icon: <Signpost color={colors.gold} size={14} />,
    });
  }

  if (route.recommended && route.recommendReason) {
    badges.push({
      key: 'recommended',
      label: route.recommendReason,
      tone: 'primary',
      icon: <Milestone color={colors.primaryLight} size={14} />,
    });
  }

  return badges;
}

/**
 * The alternative's own flood and surface figures. It carries no
 * `flood_avoidance_failed` — that is a property of the request, not of one
 * candidate line — so only the three per-route facts are shown.
 */
function getAlternativeBadges(alternative: RouteAlternative) {
  const badges: Array<{ key: string; label: string; tone: BadgeTone; icon: ReactNode }> = [];

  if (typeof alternative.flood_crossings === 'number' && alternative.flood_crossings > 0) {
    badges.push({
      key: 'alt-flood-crossings',
      label: `Crosses ${alternative.flood_crossings} flood-prone area${alternative.flood_crossings > 1 ? 's' : ''}`,
      tone: 'warning',
      icon: <Waves color={colors.gold} size={14} />,
    });
  }

  if (alternative.has_unpaved) {
    const distance =
      typeof alternative.unpaved_distance_m === 'number' ? formatDistance(alternative.unpaved_distance_m) : null;
    badges.push({
      key: 'alt-unpaved',
      label: distance ? `Unpaved · ${distance}` : 'Includes unpaved road',
      tone: 'warning',
      icon: <Signpost color={colors.gold} size={14} />,
    });
  }

  if (alternative.rain_note) {
    badges.push({
      key: 'alt-rain',
      label: alternative.rain_note,
      tone: 'warning',
      icon: <TriangleAlert color={colors.gold} size={14} />,
    });
  }

  return badges;
}

const badgeToneStyles = StyleSheet.create({
  danger: { borderColor: colors.danger },
  warning: { borderColor: colors.gold },
  primary: { borderColor: colors.primary },
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryPrimary: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  summaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sheetAction: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minWidth: 64,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.round,
    borderWidth: 1,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  warningsList: {
    gap: spacing.xs,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  warningText: {
    flex: 1,
  },
  section: {
    gap: spacing.sm,
  },
  alternativeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    padding: spacing.md,
  },
  alternativeRowSelected: {
    borderColor: mapColors.primary,
    backgroundColor: mapColors.primaryContainer,
  },
  alternativeText: {
    flex: 1,
    gap: spacing.xs,
  },
  laneRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  lane: {
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 2,
  },
  laneActive: {
    borderColor: mapColors.primary,
    backgroundColor: mapColors.primaryContainer,
  },
  promotionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.cardAlt,
    padding: spacing.md,
  },
  promotionText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  /**
   * Selection is carried by a left-edge bar as well as a background tint. The
   * tap tints the same green as the highlighted polyline, and the two greens are
   * too close to separate by hue alone.
   */
  stepRowSelected: {
    backgroundColor: colors.cardAlt,
    borderLeftWidth: 3,
    borderLeftColor: mapRoute.selected,
  },
  stepInstructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  stepInstruction: {
    flex: 1,
  },
  stepSpeak: {
    // 44 is the minimum comfortable touch target, but the icon is 16 — padding
    // gets the target to size without making the row look padded.
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.sm,
    marginTop: -spacing.xs,
  },
  stepDot: {
    width: 8,
    height: 8,
    marginTop: spacing.xs,
    borderRadius: radius.round,
    backgroundColor: colors.primary,
  },
  /** Beats the traffic tint, which is also green on a clear road. */
  stepDotSelected: {
    backgroundColor: mapRoute.selected,
    borderRadius: 0,
    transform: [{ rotate: '45deg' }],
  },
  stepText: {
    flex: 1,
    gap: spacing.xs,
  },
});
