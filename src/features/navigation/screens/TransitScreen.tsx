import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Bus, Footprints, LocateFixed } from 'lucide-react-native';

import { getTransitDepartures, type TransitDeparture } from '../../../api/transit';
import { AppButton, AppText, BackButton, EmptyState, ErrorBanner, LoadingState, Screen } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { formatDistance } from '../../../utils/landmarkKinds';

/** Wider than the 400 m default: a trotro stop is often a few streets over. */
const SEARCH_RADIUS_M = 800;

/**
 * What can be boarded near the user right now.
 *
 * Deliberately *not* a trip planner — planning an A-to-B trotro trip is the
 * Trotro mode in Directions, which already holds the From and To. Two places to
 * plan the same journey is the kind of duplication that makes an app hard to
 * learn, so this screen only answers the question Directions cannot: "I am
 * standing here, what can I get on?"
 */
export function TransitScreen() {
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const locate = useCallback(async () => {
    setIsLocating(true);
    setLocationMessage(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        setLocationMessage('Location is off, so we cannot tell what is boardable near you.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPoint({ lat: position.coords.latitude, lng: position.coords.longitude });
    } catch (error) {
      setLocationMessage(error instanceof Error ? error.message : 'Could not read your location.');
    } finally {
      setIsLocating(false);
    }
  }, []);

  useEffect(() => {
    void locate();
  }, [locate]);

  const departuresQuery = useQuery({
    queryKey: ['transit', 'departures', point?.lat, point?.lng],
    queryFn: () =>
      getTransitDepartures({ lat: point?.lat ?? 0, lng: point?.lng ?? 0, radiusM: SEARCH_RADIUS_M }),
    enabled: point !== null,
    staleTime: 60_000,
  });

  const data = departuresQuery.data;

  return (
    <Screen scroll contentStyle={styles.content}>
        <BackButton />

      {locationMessage ? <ErrorBanner message={locationMessage} /> : null}

      <AppButton
        variant="secondary"
        icon={<LocateFixed color={colors.text} size={18} />}
        onPress={() => void locate()}
        loading={isLocating}
      >
        Check around me
      </AppButton>

      {departuresQuery.isPending && point ? <LoadingState label="Finding trotros and buses" /> : null}

      {departuresQuery.error ? <ErrorBanner message="Could not load departures right now." /> : null}

      {/* `no_routes` separates "nothing nearby" from "everything here
          terminates, walk on" — the note says which, so it leads. */}
      {data && data.count === 0 ? (
        <EmptyState
          title={data.noRoutes ? 'Nothing boardable nearby' : 'No departures found'}
          description={data.note || 'Try again from closer to a main road or a station.'}
        />
      ) : null}

      {data && data.count > 0 ? (
        <>
          <AppText variant="caption" tone="muted">
            {data.count} line{data.count === 1 ? '' : 's'} from {data.stops.length} stop
            {data.stops.length === 1 ? '' : 's'} within {formatDistance(SEARCH_RADIUS_M)}
          </AppText>

          <View style={styles.list}>
            {data.routes.map((route, index) => (
              <DepartureRow key={`${route.shortName}-${route.stopName}-${index}`} route={route} />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function DepartureRow({ route }: { route: TransitDeparture }) {
  return (
    <View style={styles.row}>
      <Bus color={colors.primaryLight} size={20} />

      <View style={styles.rowText}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {route.shortName}
          {route.destination ? ` → ${route.destination}` : ''}
        </AppText>

        {route.longName ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {route.longName}
          </AppText>
        ) : null}

        {route.stopName ? (
          <View style={styles.walkRow}>
            <Footprints color={colors.faint} size={14} />
            <AppText variant="caption" tone="faint" numberOfLines={1}>
              {route.stopName}
              {typeof route.stopDistanceM === 'number' ? ` · ${formatDistance(route.stopDistanceM)}` : ''}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  list: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  walkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
