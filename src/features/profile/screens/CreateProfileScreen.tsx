import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { AtSign, Check, Copy, X } from 'lucide-react-native';
import { useMutation, useQuery } from '@tanstack/react-query';

import { ApiRequestError } from '../../../api/client';
import {
  buildProfileUrl,
  checkSlugAvailable,
  createProfile,
  getSlugProblem,
  normalizeSlug,
} from '../../../api/profile';
import { AppButton, AppInput, AppText, BackButton, ErrorBanner, Screen } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { hapticSuccess } from '../../../utils/haptics';
import { rememberOwnedId, setEditToken } from '../../../storage/editTokens';
import { useDebouncedValue } from '../../search/hooks/useDebouncedValue';
import { BusinessLocationField } from '../../business/components/BusinessLocationField';
import { useBusinessLocation } from '../../business/hooks/useBusinessLocation';
import { SavedAddresses } from '../components/SavedAddresses';

/**
 * Creating a shareable `@handle` for a place.
 *
 * The screen's real job is the edit token: it is issued once, never
 * recoverable, and there is no account behind the feature. So it is written to
 * SecureStore before the success state renders, and shown to the user with an
 * explanation rather than tucked away.
 */
export function CreateProfileScreen() {
  const router = useRouter();
  const [slugInput, setSlugInput] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');
  const [floodAlertsOn, setFloodAlertsOn] = useState(false);
  const [alertEmail, setAlertEmail] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [created, setCreated] = useState<{ slug: string; editToken?: string } | null>(null);

  const businessLocation = useBusinessLocation();
  const { search: searchLocations } = businessLocation;
  const debouncedLocationQuery = useDebouncedValue(locationQuery, 300);
  const slug = normalizeSlug(slugInput);
  const debouncedSlug = useDebouncedValue(slug, 400);
  const slugProblem = slug.length > 0 ? getSlugProblem(slug) : null;

  useEffect(() => {
    void searchLocations(debouncedLocationQuery);
  }, [debouncedLocationQuery, searchLocations]);

  const availability = useQuery({
    queryKey: ['profile', 'check', debouncedSlug],
    queryFn: () => checkSlugAvailable(debouncedSlug),
    enabled: debouncedSlug.length >= 3 && getSlugProblem(debouncedSlug) === null,
    staleTime: 30_000,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: createProfile,
    onSuccess: async (result) => {
      hapticSuccess();

      if (result.editToken) {
        await setEditToken('profile', result.profile.slug, result.editToken);
        await rememberOwnedId('profile', result.profile.slug);
      }

      setCreated({ slug: result.profile.slug, editToken: result.editToken });
    },
  });

  const canSubmit =
    slug.length >= 3 &&
    slugProblem === null &&
    availability.data === true &&
    businessLocation.location !== null &&
    (!floodAlertsOn || alertEmail.trim().length > 0) &&
    !createMutation.isPending;

  const handleSubmit = () => {
    if (!businessLocation.location || !canSubmit) {
      return;
    }

    createMutation.mutate({
      slug,
      lat: businessLocation.location.lat,
      lng: businessLocation.location.lng,
      ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
      ...(label.trim() ? { label: label.trim() } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(floodAlertsOn ? { floodAlertsOn: true, alertEmail: alertEmail.trim() } : {}),
    });
  };

  if (created) {
    const url = buildProfileUrl(created.slug);

    return (
      <Screen scroll contentStyle={styles.content}>
        <BackButton />

        <View style={styles.card}>
          <AtSign color={colors.primaryLight} size={28} />
          <AppText variant="subtitle">@{created.slug}</AppText>
          <AppText variant="body" tone="muted">
            Anyone can open this link to see the place — no app or account needed.
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy the profile link"
            onPress={() => {
              void Clipboard.setStringAsync(url);
              Alert.alert('Copied', url);
            }}
            style={({ pressed }) => [styles.tokenRow, pressed && styles.pressed]}
          >
            <AppText variant="caption" numberOfLines={1} style={styles.tokenValue}>
              {url}
            </AppText>
            <Copy color={colors.primaryLight} size={18} />
          </Pressable>
        </View>

        {created.editToken ? (
          <View style={styles.tokenCard}>
            <AppText variant="bodyStrong">Save your edit code</AppText>
            <AppText variant="caption" tone="muted">
              Shown once and impossible to recover. There is no account behind this — losing it means the
              profile can never be changed or deleted. We have kept a copy on this phone.
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy the edit code"
              onPress={() => {
                void Clipboard.setStringAsync(created.editToken ?? '');
                Alert.alert('Copied', 'Keep it somewhere safe.');
              }}
              style={({ pressed }) => [styles.tokenRow, pressed && styles.pressed]}
            >
              <AppText variant="code" numberOfLines={1} style={styles.tokenValue}>
                {created.editToken}
              </AppText>
              <Copy color={colors.primaryLight} size={18} />
            </Pressable>
          </View>
        ) : null}

        <AppButton onPress={() => router.replace(`/profile/${created.slug}`)}>View it</AppButton>
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
        <BackButton />

      <AppText variant="body" tone="muted">
        Pick a handle and a place. You get a permanent link anyone can open — useful for deliveries,
        directions to your shop, or telling a driver where you live.
      </AppText>

      <SavedAddresses />

      {createMutation.error ? <ErrorBanner message={getCreateError(createMutation.error)} /> : null}

      <View style={styles.field}>
        <AppText variant="caption" tone="muted">
          Handle
        </AppText>
        <View style={styles.slugRow}>
          <AppText variant="body" tone="faint">
            @
          </AppText>
          <AppInput
            value={slugInput}
            onChangeText={setSlugInput}
            placeholder="kofi-adjei"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
            style={styles.slugInput}
            accessibilityLabel="Your handle"
          />
          {availability.data === true ? <Check color={colors.primaryLight} size={20} /> : null}
          {availability.data === false ? <X color={colors.danger} size={20} /> : null}
        </View>
        <AppText variant="caption" tone={slugProblem || availability.data === false ? 'danger' : 'faint'}>
          {slugProblem ??
            (availability.data === false
              ? 'That handle is taken or reserved.'
              : 'Lowercase letters, numbers and hyphens. 3–30 characters.')}
        </AppText>
      </View>

      <View style={styles.field}>
        <AppText variant="caption" tone="muted">
          Which place?
        </AppText>
        <BusinessLocationField
          query={locationQuery}
          onChangeQuery={setLocationQuery}
          onSubmitQuery={() => void businessLocation.submit(locationQuery)}
          location={businessLocation.location}
          suggestions={businessLocation.suggestions}
          isSearching={businessLocation.isSearching}
          isLocating={businessLocation.isLocating}
          isResolving={businessLocation.isResolving}
          message={businessLocation.message}
          onSelectSuggestion={businessLocation.selectSuggestion}
          onUseDeviceLocation={() => void businessLocation.useDeviceLocation()}
          onClear={() => {
            businessLocation.clear();
            setLocationQuery('');
          }}
        />
      </View>

      <View style={styles.field}>
        <AppText variant="caption" tone="muted">
          Name it (optional)
        </AppText>
        <AppInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Kofi's place"
          accessibilityLabel="Display name"
        />
      </View>

      <View style={styles.field}>
        <AppText variant="caption" tone="muted">
          Directions note (optional)
        </AppText>
        <AppInput
          value={label}
          onChangeText={setLabel}
          placeholder="East Legon, near the junction"
          accessibilityLabel="Directions note"
        />
      </View>

      <View style={styles.field}>
        <AppText variant="caption" tone="muted">
          Phone (optional)
        </AppText>
        <AppInput
          value={phone}
          onChangeText={setPhone}
          placeholder="+233 20 123 4567"
          keyboardType="phone-pad"
          accessibilityLabel="Phone number"
        />
        <AppText variant="caption" tone="faint">
          Only you can see this — it is not part of the public profile.
        </AppText>
      </View>

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <AppText variant="body">Flood alerts</AppText>
          <AppText variant="caption" tone="muted">
            Email me if this place falls inside a flood-risk zone.
          </AppText>
        </View>
        <Switch
          value={floodAlertsOn}
          onValueChange={setFloodAlertsOn}
          accessibilityLabel="Flood alerts"
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>

      {floodAlertsOn ? (
        <View style={styles.field}>
          <AppText variant="caption" tone="muted">
            Alert email
          </AppText>
          <AppInput
            value={alertEmail}
            onChangeText={setAlertEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            accessibilityLabel="Alert email"
          />
          <AppText variant="caption" tone="faint">
            Required while flood alerts are on.
          </AppText>
        </View>
      ) : null}

      <AppButton onPress={handleSubmit} disabled={!canSubmit} loading={createMutation.isPending}>
        Save my address
      </AppButton>
    </Screen>
  );
}

function getCreateError(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.code === 'ALERT_EMAIL_REQUIRED') {
      return 'Add an email address, or turn flood alerts off.';
    }

    return error.message;
  }

  return error instanceof Error ? error.message : 'Could not save the address right now.';
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  slugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  slugInput: {
    flex: 1,
    minWidth: 0,
  },
  card: {
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
  },
  tokenCard: {
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.card,
    padding: spacing.lg,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: spacing.md,
  },
  tokenValue: {
    flex: 1,
    minWidth: 0,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  switchText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
