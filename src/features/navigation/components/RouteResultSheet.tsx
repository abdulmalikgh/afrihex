import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Milestone, Signpost, TriangleAlert, Waves } from 'lucide-react-native';

import { AppText, EmptyState, ErrorBanner, LoadingState } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { formatDistance } from '../../../utils/landmarkKinds';
import type { DirectionsState, PlannedRoute } from '../types/directions';
import { formatDuration } from '../utils/directionsFormatting';

type RouteResultSheetProps = {
  state: DirectionsState;
};

export function RouteResultSheet({ state }: RouteResultSheetProps) {
  if (state.status === 'idle') {
    return null;
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
  const badges = getBadges(route);

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryPrimary}>
          <AppText variant="title">{formatDuration(route.etaS)}</AppText>
          <AppText variant="caption" tone="muted">
            {formatDistance(route.distanceM)} · {route.trafficNote}
          </AppText>
        </View>
      </View>

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
          <AppText variant="subtitle">Alternatives</AppText>
          {route.alternatives.map((alternative, index) => (
            <View key={index} style={styles.alternativeRow}>
              <View style={styles.alternativeText}>
                <AppText variant="bodyStrong">
                  {formatDuration(alternative.eta_s)} · {formatDistance(alternative.distance_m)}
                </AppText>
                {alternative.recommend_reason ? (
                  <AppText variant="caption" tone="muted">
                    {alternative.recommend_reason}
                  </AppText>
                ) : null}
              </View>
              {alternative.recommended ? (
                <Badge tone="primary" icon={<Milestone color={colors.primaryLight} size={14} />}>
                  Recommended
                </Badge>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText variant="subtitle">Steps</AppText>
        {route.steps.map((step, index) => (
          <View key={index} style={styles.stepRow}>
            <View style={[styles.stepDot, step.traffic_color ? { backgroundColor: step.traffic_color } : null]} />
            <View style={styles.stepText}>
              <AppText variant="body">{step.instruction}</AppText>
              {step.instruction_landmark ? (
                <AppText variant="caption" tone="muted">
                  {step.instruction_landmark}
                </AppText>
              ) : null}
              <AppText variant="caption" tone="faint">
                {formatDistance(step.distance_m)}
              </AppText>
            </View>
          </View>
        ))}
      </View>
    </View>
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
    gap: spacing.xs,
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
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    padding: spacing.md,
  },
  alternativeText: {
    flex: 1,
    gap: spacing.xs,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepDot: {
    width: 8,
    height: 8,
    marginTop: spacing.xs,
    borderRadius: radius.round,
    backgroundColor: colors.primary,
  },
  stepText: {
    flex: 1,
    gap: spacing.xs,
  },
});
