import { StyleSheet, View } from 'react-native';
import { ArrowRight, Bus, Clock, Footprints, TriangleAlert } from 'lucide-react-native';

import type { TransitItinerary, TransitLeg, TransitPlan } from '../../../api/transit';
import { AppText, EmptyState, ErrorBanner, LoadingState } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { formatDistance } from '../../../utils/landmarkKinds';
import { formatDuration } from '../utils/directionsFormatting';

type TransitResultSheetProps = {
  isLoading: boolean;
  hasEndpoints: boolean;
  plan: TransitPlan | null;
  errorMessage: string | null;
};

/**
 * Trotro and bus options for the trip currently in the From/To fields.
 *
 * The rule that shapes this: OTP answers "no service" with a plain walking
 * itinerary rather than an empty list, so a 91-minute walk can arrive looking
 * like a successful plan. `no_transit` is the real signal and is read before
 * anything else — gating on an empty list would present that walk as the answer.
 */
export function TransitResultSheet({
  isLoading,
  hasEndpoints,
  plan,
  errorMessage,
}: TransitResultSheetProps) {
  if (!hasEndpoints) {
    return (
      <EmptyState
        title="Trotro route"
        description="Add a start and a destination above, and the trotro and bus options appear here."
      />
    );
  }

  if (isLoading) {
    return <LoadingState label="Finding trotros" />;
  }

  if (errorMessage) {
    return <ErrorBanner message={errorMessage} />;
  }

  if (!plan) {
    return null;
  }

  if (plan.noTransit) {
    const trip = plan.firstTrip ?? plan.lastTrip;

    return (
      <View style={styles.container}>
        <View style={styles.noServiceHeader}>
          <TriangleAlert color={colors.gold} size={20} />
          <AppText variant="subtitle">No trotro for this trip</AppText>
        </View>

        <AppText variant="body" tone="muted">
          {plan.note || 'A bus route does not beat walking here.'}
        </AppText>

        {/* `first_trip` and `last_trip` never both appear — whichever is set
            says why it missed: too early, or already gone for the day. Neither
            means a real network gap, and then `note` is the whole story. */}
        {trip ? (
          <View style={styles.tripRow}>
            <Clock color={colors.primaryLight} size={16} />
            <AppText variant="caption" tone="muted" style={styles.tripText}>
              {plan.firstTrip ? 'First today' : 'Last today'}: {trip.shortName ?? 'service'}
              {trip.stopName ? ` from ${trip.stopName}` : ''}
              {trip.time ? ` at ${trip.time}` : ''}
            </AppText>
          </View>
        ) : null}

        <AppText variant="caption" tone="faint">
          Switch to Drive, Okada or Walk above to see another way there.
        </AppText>
      </View>
    );
  }

  if (plan.itineraries.length === 0) {
    return (
      <EmptyState title="Nothing came back" description={plan.note || 'Try a nearby stop or station.'} />
    );
  }

  return (
    <View style={styles.container}>
      <AppText variant="title">
        {plan.count} option{plan.count === 1 ? '' : 's'}
      </AppText>

      {plan.itineraries.map((itinerary, index) => (
        <ItineraryCard key={index} itinerary={itinerary} />
      ))}
    </View>
  );
}

function ItineraryCard({ itinerary }: { itinerary: TransitItinerary }) {
  return (
    <View style={styles.itinerary}>
      <View>
        <AppText variant="bodyStrong">
          {itinerary.durationS ? formatDuration(itinerary.durationS) : 'Trip'}
        </AppText>
        <AppText variant="caption" tone="muted">
          {typeof itinerary.transfers === 'number'
            ? `${itinerary.transfers} transfer${itinerary.transfers === 1 ? '' : 's'}`
            : ''}
          {typeof itinerary.walkDistanceM === 'number'
            ? `${typeof itinerary.transfers === 'number' ? ' · ' : ''}${formatDistance(
                itinerary.walkDistanceM,
              )} walking`
            : ''}
        </AppText>
      </View>

      <View style={styles.legs}>
        {itinerary.legs.map((leg, index) => (
          <LegRow key={index} leg={leg} isLast={index === itinerary.legs.length - 1} />
        ))}
      </View>
    </View>
  );
}

function LegRow({ leg, isLast }: { leg: TransitLeg; isLast: boolean }) {
  const isWalk = leg.mode === 'WALK';

  return (
    <View style={styles.leg}>
      {isWalk ? <Footprints color={colors.muted} size={16} /> : <Bus color={colors.primaryLight} size={16} />}

      <View style={styles.legText}>
        <AppText variant="caption" numberOfLines={1}>
          {isWalk
            ? `Walk${leg.distanceM ? ` ${formatDistance(leg.distanceM)}` : ''}`
            : [leg.routeShortName, leg.routeLongName].filter(Boolean).join(' · ') || 'Bus'}
        </AppText>
        {leg.toName ? (
          <AppText variant="caption" tone="faint" numberOfLines={1}>
            to {leg.toName}
          </AppText>
        ) : null}
      </View>

      {isLast ? null : <ArrowRight color={colors.faint} size={14} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  noServiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  tripText: {
    flex: 1,
    minWidth: 0,
  },
  itinerary: {
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    padding: spacing.md,
  },
  legs: {
    gap: spacing.xs,
  },
  leg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legText: {
    flex: 1,
    minWidth: 0,
  },
});
