import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';

import { createMeetSession } from '../../../api/meet';
import { AppButton, AppInput, AppText, BackButton, ErrorBanner, Screen } from '../../../components';
import { colors } from '../../../constants/colors';
import { spacing } from '../../../constants/spacing';
import { hapticSuccess } from '../../../utils/haptics';
import { rememberOwnedId, setEditToken } from '../../../storage/editTokens';
import { ActiveMeetups } from '../components/ActiveMeetups';
import { useDebouncedValue } from '../../search/hooks/useDebouncedValue';
import { BusinessLocationField } from '../../business/components/BusinessLocationField';
import { useBusinessLocation } from '../../business/hooks/useBusinessLocation';

/**
 * Starting a convergence session. Everything the API needs is a destination and
 * an optional label — there is no account, no invite list, and no membership
 * until people open the link.
 */
export function CreateMeetScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ lat?: string; lng?: string; label?: string }>();
  const [label, setLabel] = useState(typeof params.label === 'string' ? params.label : '');
  const [locationQuery, setLocationQuery] = useState('');
  const hasAppliedHandoff = useRef(false);

  const destination = useBusinessLocation();
  const { search: searchLocations } = destination;
  const debouncedQuery = useDebouncedValue(locationQuery, 300);

  useEffect(() => {
    void searchLocations(debouncedQuery);
  }, [debouncedQuery, searchLocations]);

  // A place handed over from Find becomes the destination, so the user does not
  // search for somewhere they were already looking at.
  useEffect(() => {
    if (hasAppliedHandoff.current) {
      return;
    }

    const lat = Number(params.lat);
    const lng = Number(params.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    hasAppliedHandoff.current = true;
    destination.selectSuggestion({
      name: typeof params.label === 'string' ? params.label : 'Selected place',
      display_name: typeof params.label === 'string' ? params.label : 'Selected place',
      latitude: lat,
      longitude: lng,
    });
  }, [destination, params.label, params.lat, params.lng]);

  const createMutation = useMutation({
    mutationFn: createMeetSession,
    onSuccess: async (session) => {
      hapticSuccess();
      // Kept locally so the session can be listed and status-polled later —
      // the server has no list of what this device started.
      await setEditToken('meet', session.sessionId, session.joinToken);
      await rememberOwnedId('meet', session.sessionId);
      router.replace({
        pathname: '/meet/[id]',
        params: { id: session.sessionId, t: session.joinToken },
      });
    },
  });

  const handleCreate = () => {
    if (!destination.location) {
      return;
    }

    createMutation.mutate({
      destLat: destination.location.lat,
      destLng: destination.location.lng,
      ...(label.trim() ? { destLabel: label.trim() } : {}),
    });
  };

  return (
    <Screen scroll contentStyle={styles.content}>
        <BackButton />

      <View style={styles.intro}>
        <Users color={colors.primaryLight} size={24} />
        <AppText variant="body" tone="muted">
          Pick where you are all heading, then share the link. Everyone who opens it sees each other move
          toward it, live, until they arrive. No account needed — and it expires after six hours.
        </AppText>
      </View>

      <ActiveMeetups />

      {createMutation.error ? (
        <ErrorBanner
          message={
            createMutation.error instanceof Error
              ? createMutation.error.message
              : 'Could not start the meetup.'
          }
        />
      ) : null}

      <View style={styles.field}>
        <AppText variant="caption" tone="muted">
          Where are you meeting?
        </AppText>
        <BusinessLocationField
          query={locationQuery}
          onChangeQuery={setLocationQuery}
          placeholder="Destination, AfriHex code, hex code or lat, lng"
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
          Call it something (optional)
        </AppText>
        <AppInput
          value={label}
          onChangeText={setLabel}
          placeholder="Kwame's place"
          accessibilityLabel="Meetup label"
        />
      </View>

      <AppButton
        variant="ghost"
        onPress={() => router.push('/meet/delivery')}
      >
        Courier delivery instead
      </AppButton>

      <AppButton
        onPress={handleCreate}
        disabled={!destination.location || createMutation.isPending}
        loading={createMutation.isPending}
      >
        Start the meetup
      </AppButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
});
