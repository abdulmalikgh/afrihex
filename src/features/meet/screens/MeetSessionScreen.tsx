import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import MapView, { Marker, type Region } from 'react-native-maps';
import { Check, Share2, Users } from 'lucide-react-native';

import { buildMeetJoinUrl, getMeetSession } from '../../../api/meet';
import { AppButton, AppText, BackButton, ErrorBanner, Screen } from '../../../components';
import { colors } from '../../../constants/colors';
import { mapDarkStyle } from '../../../constants/mapStyle';
import { mapColors } from '../../../constants/material';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { hapticSuccess } from '../../../utils/haptics';
import { useMeetSocket } from '../hooks/useMeetSocket';

const DEFAULT_REGION: Region = {
  latitude: 5.6037,
  longitude: -0.187,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

/**
 * A live meet session: the destination, everyone converging on it, and this
 * device's own position going out over the socket.
 *
 * The position watcher is deliberately coarse — the socket throttles to one
 * update per five seconds per member anyway, so a tighter watcher would only
 * burn battery producing updates that get dropped.
 */
export function MeetSessionScreen() {
  const router = useRouter();
  const { id, t } = useLocalSearchParams<{ id?: string; t?: string }>();
  const sessionId = typeof id === 'string' ? id : '';
  const joinToken = typeof t === 'string' ? t : '';

  const [displayName] = useState('Me');
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();

  const session = useMeetSocket({
    sessionId,
    joinToken,
    displayName,
    enabled: sessionId.length > 0 && joinToken.length > 0,
  });

  /**
   * The initial snapshot, fetched once before the socket has said anything.
   * The socket's `state` message carries the same thing, but it arrives only
   * after connect → join → welcome, and the destination should be on screen
   * before that round trip finishes.
   */
  const initialQuery = useQuery({
    queryKey: ['meet', sessionId],
    queryFn: () => getMeetSession(sessionId, joinToken),
    enabled: sessionId.length > 0 && joinToken.length > 0,
    staleTime: 60_000,
    retry: false,
  });

  const { sendPosition, allArrived } = session;

  // Shares this device's position for as long as the screen is open.
  useEffect(() => {
    if (!sessionId || !joinToken) {
      return;
    }

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        setLocationMessage(
          'Location is off, so others cannot see you moving. You can still see them.',
        );
        return;
      }

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 20, timeInterval: 5_000 },
        (position) => {
          sendPosition(
            position.coords.latitude,
            position.coords.longitude,
            position.coords.accuracy ?? undefined,
          );
        },
      );

      if (cancelled) {
        subscription.remove();
        subscription = null;
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [joinToken, sendPosition, sessionId]);

  useEffect(() => {
    if (allArrived) {
      hapticSuccess();
    }
  }, [allArrived]);

  // The socket wins once it has spoken; the fetch only fills the gap before that.
  const destination =
    session.destination.lat !== undefined ? session.destination : (initialQuery.data?.destination ?? {});
  const members = session.members.length > 0 ? session.members : (initialQuery.data?.members ?? []);

  useEffect(() => {
    if (typeof destination.lat === 'number' && typeof destination.lng === 'number') {
      mapRef.current?.animateToRegion(
        { latitude: destination.lat, longitude: destination.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        650,
      );
    }
  }, [destination.lat, destination.lng]);

  if (!sessionId || !joinToken) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackButton />

        <ErrorBanner message="This meetup link is missing its session or token." />
      </Screen>
    );
  }

  const arrivedCount = members.filter((member) => member.hasArrived).length;
  const joinUrl = buildMeetJoinUrl(sessionId, joinToken);

  return (
    <Screen bleed maskStatusBar={false}>
      <View style={styles.stage}>
        {/* Floating, because this screen is a full-bleed map with no header to
            sit in — but it is still the only way back off it. */}
        <View style={[styles.backFloat, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
          <BackButton />
        </View>

        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={DEFAULT_REGION}
          customMapStyle={mapDarkStyle}
          userInterfaceStyle="dark"
          loadingEnabled
          loadingBackgroundColor={mapColors.surfaceContainerLow}
          loadingIndicatorColor={mapColors.primary}
          rotateEnabled={false}
          pitchEnabled={false}
          accessibilityLabel="Meetup map"
        >
          {typeof destination.lat === 'number' && typeof destination.lng === 'number' ? (
            <Marker
              coordinate={{ latitude: destination.lat, longitude: destination.lng }}
              tracksViewChanges={false}
              accessibilityLabel={destination.label ?? 'Destination'}
            >
              <View style={styles.destinationPin} />
            </Marker>
          ) : null}

          {members.map((member) =>
            typeof member.lat === 'number' && typeof member.lng === 'number' ? (
              <Marker
                key={member.memberId}
                coordinate={{ latitude: member.lat, longitude: member.lng }}
                tracksViewChanges={false}
                title={member.displayName}
                description={member.hasArrived ? 'Arrived' : member.role}
                accessibilityLabel={`${member.displayName}${member.hasArrived ? ', arrived' : ''}`}
              >
                <View style={[styles.memberPin, member.hasArrived && styles.memberPinArrived]} />
              </Marker>
            ) : null,
          )}
        </MapView>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Users color={colors.primaryLight} size={20} />
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.panelTitle}>
              {destination.label ?? 'Meeting point'}
            </AppText>
            <ConnectionDot state={session.connection} />
          </View>

          <AppText variant="caption" tone="muted">
            {members.length} here · {arrivedCount} arrived
          </AppText>

          {session.allArrived ? (
            <View style={styles.allArrived}>
              <Check color={colors.primaryLight} size={16} />
              <AppText variant="caption" tone="primary">
                Everyone has arrived.
              </AppText>
            </View>
          ) : null}

          {session.errorMessage ? <ErrorBanner message={session.errorMessage} /> : null}

          {locationMessage ? (
            <AppText variant="caption" tone="muted">
              {locationMessage}
            </AppText>
          ) : null}

          <View style={styles.actions}>
            <AppButton
              variant="secondary"
              icon={<Share2 color={colors.text} size={18} />}
              onPress={() =>
                void Share.share({
                  message: `Meet me at ${destination.label ?? 'the pin'}: ${joinUrl}`,
                })
              }
            >
              Share the link
            </AppButton>
            <AppButton
              variant="ghost"
              onPress={() => {
                session.leave();
                Alert.alert('Left the meetup', 'Others will stop seeing your position.');
                router.back();
              }}
            >
              Leave
            </AppButton>
          </View>
        </View>
      </View>
    </Screen>
  );
}

function ConnectionDot({ state }: { state: 'connecting' | 'open' | 'closed' | 'error' }) {
  const label =
    state === 'open' ? 'Live' : state === 'connecting' ? 'Connecting' : state === 'error' ? 'Offline' : 'Reconnecting';

  return (
    <View style={styles.connection} accessibilityLabel={`Connection: ${label}`}>
      <View
        style={[
          styles.connectionDot,
          state === 'open' ? styles.connectionOpen : state === 'error' ? styles.connectionError : null,
        ]}
      />
      {/* Paired with the dot so connection state never rests on colour alone. */}
      <AppText variant="caption" tone="faint">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  backFloat: {
    position: 'absolute',
    left: spacing.lg,
    zIndex: 9,
    borderRadius: radius.round,
    backgroundColor: colors.card,
  },
  stage: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  map: {
    flex: 1,
    backgroundColor: mapColors.surfaceContainerLow,
  },
  panel: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.lg,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  panelTitle: {
    flex: 1,
    minWidth: 0,
  },
  connection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: radius.round,
    backgroundColor: colors.muted,
  },
  connectionOpen: {
    backgroundColor: colors.primaryLight,
  },
  connectionError: {
    backgroundColor: colors.danger,
  },
  allArrived: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
  },
  destinationPin: {
    width: 22,
    height: 22,
    borderRadius: radius.round,
    backgroundColor: colors.gold,
    borderWidth: 3,
    borderColor: colors.white,
  },
  memberPin: {
    width: 18,
    height: 18,
    borderRadius: radius.round,
    backgroundColor: colors.violet,
    borderWidth: 2,
    borderColor: colors.white,
  },
  memberPinArrived: {
    backgroundColor: colors.primary,
  },
});
