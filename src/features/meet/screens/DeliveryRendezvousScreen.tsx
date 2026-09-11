import { useEffect, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useMutation } from '@tanstack/react-query';
import { Bike, Copy, PackageCheck, User } from 'lucide-react-native';

import { createRendezvous } from '../../../api/meet';
import { AppButton, AppInput, AppText, BackButton, ErrorBanner, Screen } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { hapticSuccess } from '../../../utils/haptics';
import { rememberOwnedId, setEditToken } from '../../../storage/editTokens';
import { useDebouncedValue } from '../../search/hooks/useDebouncedValue';
import { BusinessLocationField } from '../../business/components/BusinessLocationField';
import { useBusinessLocation } from '../../business/hooks/useBusinessLocation';

/**
 * The courier↔customer framing of a meet session.
 *
 * One session and one token underneath — role is only a query parameter on the
 * join URL, not a separate credential — so both links reach the same live map.
 * The screen's job is handing each side its own link.
 */
export function DeliveryRendezvousScreen() {
  const router = useRouter();
  const [trackingRef, setTrackingRef] = useState('');
  const [courierName, setCourierName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [locationQuery, setLocationQuery] = useState('');

  const destination = useBusinessLocation();
  const { search: searchLocations } = destination;
  const debouncedQuery = useDebouncedValue(locationQuery, 300);

  useEffect(() => {
    void searchLocations(debouncedQuery);
  }, [debouncedQuery, searchLocations]);

  const createMutation = useMutation({
    mutationFn: createRendezvous,
    onSuccess: async (session) => {
      hapticSuccess();
      // Stored so the session shows up under "in progress" later — there is no
      // server-side list of sessions this device started.
      await setEditToken('meet', session.sessionId, session.joinToken);
      await rememberOwnedId('meet', session.sessionId);
    },
  });

  const created = createMutation.data;

  if (created) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackButton />

        <View style={styles.card}>
          <PackageCheck color={colors.primaryLight} size={28} />
          <AppText variant="subtitle">{created.sessionId}</AppText>
          <AppText variant="body" tone="muted">
            Send each side its own link. Both open the same live map — the role just decides how each
            person is labelled on it.
          </AppText>
        </View>

        <JoinLinkCard
          icon={<Bike color={colors.primaryLight} size={20} />}
          title="Courier link"
          url={created.courierJoinUrl}
        />

        <JoinLinkCard
          icon={<User color={colors.primaryLight} size={20} />}
          title="Customer link"
          url={created.customerJoinUrl}
        />

        <AppButton
          onPress={() =>
            router.replace({
              pathname: '/meet/[id]',
              params: { id: created.sessionId, t: created.joinToken },
            })
          }
        >
          Open the live map
        </AppButton>
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
        <BackButton />

      <AppText variant="body" tone="muted">
        Share live position between a courier and a customer until the drop-off is made. No account on
        either side, and it expires after six hours.
      </AppText>

      {createMutation.error ? (
        <ErrorBanner
          message={
            createMutation.error instanceof Error
              ? createMutation.error.message
              : 'Could not start the delivery.'
          }
        />
      ) : null}

      <View style={styles.field}>
        <AppText variant="caption" tone="muted">
          Drop-off point
        </AppText>
        <BusinessLocationField
          query={locationQuery}
          onChangeQuery={setLocationQuery}
          placeholder="Drop-off, AfriHex code, hex code or lat, lng"
          onSubmitQuery={() => void destination.submit(locationQuery)}
          location={destination.location}
          suggestions={destination.suggestions}
          isSearching={destination.isSearching}
          isLocating={destination.isLocating}
          isResolving={destination.isResolving}
          message={destination.message}
          onSelectSuggestion={destination.selectSuggestion}
          onUseDeviceLocation={() => void destination.useDeviceLocation()}
          onClear={() => {
            destination.clear();
            setLocationQuery('');
          }}
        />
      </View>

      <View style={styles.field}>
        <AppText variant="caption" tone="muted">
          Order reference (optional)
        </AppText>
        <AppInput
          value={trackingRef}
          onChangeText={setTrackingRef}
          placeholder="ORD-123"
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Order reference"
        />
      </View>

      <View style={styles.field}>
        <AppText variant="caption" tone="muted">
          Courier name (optional)
        </AppText>
        <AppInput value={courierName} onChangeText={setCourierName} accessibilityLabel="Courier name" />
      </View>

      <View style={styles.field}>
        <AppText variant="caption" tone="muted">
          Customer name (optional)
        </AppText>
        <AppInput value={customerName} onChangeText={setCustomerName} accessibilityLabel="Customer name" />
      </View>

      <AppButton
        onPress={() => {
          if (destination.location) {
            createMutation.mutate({
              destLat: destination.location.lat,
              destLng: destination.location.lng,
              destLabel: destination.location.label,
              ...(trackingRef.trim() ? { trackingRef: trackingRef.trim() } : {}),
              ...(courierName.trim() ? { courierName: courierName.trim() } : {}),
              ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
            });
          }
        }}
        disabled={!destination.location || createMutation.isPending}
        loading={createMutation.isPending}
      >
        Start the delivery
      </AppButton>
    </Screen>
  );
}

function JoinLinkCard({ icon, title, url }: { icon: React.ReactNode; title: string; url?: string }) {
  if (!url) {
    return null;
  }

  return (
    <View style={styles.linkCard}>
      <View style={styles.linkHeader}>
        {icon}
        <AppText variant="bodyStrong" style={styles.linkTitle}>
          {title}
        </AppText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Copy the ${title.toLowerCase()}`}
        onPress={() => {
          void Clipboard.setStringAsync(url);
          Alert.alert('Copied', url);
        }}
        style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
      >
        <AppText variant="caption" numberOfLines={1} style={styles.linkText}>
          {url}
        </AppText>
        <Copy color={colors.primaryLight} size={18} />
      </Pressable>

      <AppButton variant="secondary" onPress={() => void Share.share({ message: url })}>
        Send {title.replace(' link', '')}
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  card: {
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
  },
  linkCard: {
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    padding: spacing.md,
  },
  linkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  linkTitle: {
    flex: 1,
    minWidth: 0,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
  },
  linkText: {
    flex: 1,
    minWidth: 0,
    color: colors.muted,
  },
  pressed: {
    opacity: 0.7,
  },
});
