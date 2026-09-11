import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { BadgeCheck, Copy, LocateFixed, Megaphone, Store } from 'lucide-react-native';
import { useMutation, useQuery } from '@tanstack/react-query';

import { ApiRequestError } from '../../../api/client';
import {
  PROMOTION_TEXT_MAX_LENGTH,
  claimBusiness,
  validatePromotionWindow,
} from '../../../api/business';
import { geocodeLandmarks, type LandmarkMatch } from '../../../api/search';
import { AppButton, AppInput, AppText, BackButton, ErrorBanner, Screen } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { formatDistance } from '../../../utils/landmarkKinds';
import { hapticSuccess } from '../../../utils/haptics';
import { rememberOwnedId, setEditToken } from '../../../storage/editTokens';
import { useDebouncedValue } from '../../search/hooks/useDebouncedValue';
import { useBusinessLocation } from '../hooks/useBusinessLocation';

/** Days from today the expiry field defaults to. Inside the 180-day server cap. */
const DEFAULT_PROMOTION_DAYS = 7;

type Step = 'find' | 'details' | 'done';

/**
 * Claiming a landmark that is already on the map and attaching a promotion to
 * it. The sibling of Add Your Business, which covers places that are not.
 *
 * Three steps, because the claim endpoint keys on a `slug` the user has to
 * pick first: find the landmark, fill in the claim, then save the edit token.
 */
export function ClaimBusinessScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('find');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<LandmarkMatch | null>(null);

  const [claimantName, setClaimantName] = useState('');
  const [claimantPhone, setClaimantPhone] = useState('');
  const [claimantEmail, setClaimantEmail] = useState('');
  const [promotionText, setPromotionText] = useState('');
  const [expiresAt, setExpiresAt] = useState(defaultExpiry());
  const [windowError, setWindowError] = useState<string | null>(null);
  const [editToken, setIssuedEditToken] = useState<string | null>(null);

  const deviceLocation = useBusinessLocation();
  const debouncedQuery = useDebouncedValue(query.trim(), 300);

  const nameSearch = useQuery({
    queryKey: ['landmarks', 'claim-search', debouncedQuery],
    queryFn: () => geocodeLandmarks({ q: debouncedQuery, limit: 8 }),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  const nearbySearch = useQuery({
    queryKey: [
      'landmarks',
      'claim-nearby',
      deviceLocation.location?.lat,
      deviceLocation.location?.lng,
    ],
    queryFn: () =>
      geocodeLandmarks({
        near: `${deviceLocation.location?.lat},${deviceLocation.location?.lng}`,
        limit: 8,
      }),
    enabled: deviceLocation.location !== null,
    staleTime: 30_000,
  });

  // Nearest-first when anchored on the device, name matches otherwise.
  const matches = deviceLocation.location
    ? (nearbySearch.data?.matches ?? [])
    : (nameSearch.data?.matches ?? []);

  const claimMutation = useMutation({
    mutationFn: claimBusiness,
    onSuccess: async (result) => {
      hapticSuccess();

      if (result.editToken && selected) {
        // Persisted before the screen advances: this is the only time the token
        // is ever shown, and a crash between here and the next render would
        // cost the owner self-serve control permanently.
        await setEditToken('promotion', selected.slug, result.editToken);
        await rememberOwnedId('promotion', selected.slug);
      }

      setIssuedEditToken(result.editToken ?? null);
      setStep('done');
    },
  });

  useEffect(() => {
    setWindowError(null);
  }, [expiresAt]);

  const handleSubmit = () => {
    if (!selected) {
      return;
    }

    const problem = validatePromotionWindow({ expiresAt });

    if (problem) {
      setWindowError(problem);
      return;
    }

    claimMutation.mutate({
      slug: selected.slug,
      claimantName: claimantName.trim(),
      claimantPhone: claimantPhone.trim(),
      ...(claimantEmail.trim() ? { claimantEmail: claimantEmail.trim() } : {}),
      promotionText: promotionText.trim(),
      promotionExpiresAt: expiresAt,
    });
  };

  if (step === 'done') {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackButton />

        <View style={styles.card}>
          <BadgeCheck color={colors.primaryLight} size={28} />
          <AppText variant="subtitle">Claim sent</AppText>
          <AppText variant="body" tone="muted">
            {selected?.name} is in the review queue. The promotion starts running for drivers once the
            claim is approved — it is not live yet.
          </AppText>
        </View>

        {editToken ? (
          <View style={styles.tokenCard}>
            <AppText variant="bodyStrong">Save your edit code</AppText>
            <AppText variant="caption" tone="muted">
              This is shown once and cannot be recovered. It is what lets you change or cancel the
              promotion later without going through support. We have stored a copy on this phone.
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy the edit code"
              onPress={() => {
                void Clipboard.setStringAsync(editToken);
                Alert.alert('Copied', 'Keep it somewhere safe.');
              }}
              style={({ pressed }) => [styles.tokenRow, pressed && styles.pressed]}
            >
              <AppText variant="code" numberOfLines={1} style={styles.tokenValue}>
                {editToken}
              </AppText>
              <Copy color={colors.primaryLight} size={18} />
            </Pressable>
          </View>
        ) : null}

        <AppButton onPress={() => router.back()}>Done</AppButton>
      </Screen>
    );
  }

  if (step === 'find') {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackButton />

        <AppText variant="body" tone="muted">
          Find the place on the map, then attach a promotion drivers hear while navigating past it.
        </AppText>

        <AppInput
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            deviceLocation.clear();
          }}
          placeholder="Search by name"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search for your business"
        />

        <AppButton
          variant="secondary"
          icon={<LocateFixed color={colors.text} size={18} />}
          onPress={() => void deviceLocation.useDeviceLocation()}
          loading={deviceLocation.isLocating}
        >
          I am standing in it
        </AppButton>

        {deviceLocation.message ? (
          <AppText variant="caption" tone="danger">
            {deviceLocation.message}
          </AppText>
        ) : null}

        <View style={styles.matches}>
          {matches.map((match) => (
            <Pressable
              key={match.slug}
              accessibilityRole="button"
              accessibilityLabel={match.name}
              onPress={() => {
                setSelected(match);
                setStep('details');
              }}
              style={({ pressed }) => [styles.match, pressed && styles.pressed]}
            >
              <Store color={colors.muted} size={20} />
              <View style={styles.matchText}>
                <AppText variant="body" numberOfLines={1}>
                  {match.name}
                </AppText>
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {[match.street, match.kind].filter(Boolean).join(' · ')}
                </AppText>
              </View>
              {typeof match.distance_m === 'number' ? (
                <AppText variant="caption" tone="faint">
                  {formatDistance(match.distance_m)}
                </AppText>
              ) : null}
            </Pressable>
          ))}
        </View>

        {matches.length === 0 && (debouncedQuery.length >= 2 || deviceLocation.location) ? (
          <View style={styles.card}>
            <AppText variant="body" tone="muted">
              Nothing close matched. If your business is not on the map yet, add it first.
            </AppText>
            <AppButton variant="secondary" onPress={() => router.replace('/business/add')}>
              Add your business
            </AppButton>
          </View>
        ) : null}
      </Screen>
    );
  }

  const trimmedPromotion = promotionText.trim();
  const canSubmit =
    claimantName.trim().length > 0 &&
    claimantPhone.trim().length > 0 &&
    trimmedPromotion.length > 0 &&
    trimmedPromotion.length <= PROMOTION_TEXT_MAX_LENGTH &&
    !claimMutation.isPending;

  return (
    <Screen scroll contentStyle={styles.content}>
        <BackButton />

      <View style={styles.selectedCard}>
        <Store color={colors.primaryLight} size={20} />
        <AppText variant="bodyStrong" numberOfLines={1} style={styles.selectedName}>
          {selected?.name}
        </AppText>
      </View>

      {claimMutation.error ? <ErrorBanner message={getClaimError(claimMutation.error)} /> : null}

      <View style={styles.field}>
        <AppText variant="caption" tone="muted">
          Your name
        </AppText>
        <AppInput value={claimantName} onChangeText={setClaimantName} accessibilityLabel="Your name" />
      </View>

      <View style={styles.field}>
        <AppText variant="caption" tone="muted">
          Your phone
        </AppText>
        <AppInput
          value={claimantPhone}
          onChangeText={setClaimantPhone}
          placeholder="+233 20 123 4567"
          keyboardType="phone-pad"
          autoComplete="tel"
          accessibilityLabel="Your phone number"
        />
        <AppText variant="caption" tone="faint">
          Used to reach you during review.
        </AppText>
      </View>

      <View style={styles.field}>
        <AppText variant="caption" tone="muted">
          Email (optional)
        </AppText>
        <AppInput
          value={claimantEmail}
          onChangeText={setClaimantEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          accessibilityLabel="Your email"
        />
      </View>

      <View style={styles.field}>
        <View style={styles.promotionLabel}>
          <Megaphone color={colors.muted} size={16} />
          <AppText variant="caption" tone="muted">
            What should drivers hear?
          </AppText>
        </View>
        <AppInput
          value={promotionText}
          onChangeText={setPromotionText}
          placeholder="20% off all provisions this weekend"
          multiline
          maxLength={PROMOTION_TEXT_MAX_LENGTH}
          style={styles.promotionInput}
          accessibilityLabel="Promotion text"
        />
        <AppText variant="caption" tone="faint">
          {trimmedPromotion.length}/{PROMOTION_TEXT_MAX_LENGTH}
        </AppText>
      </View>

      <View style={styles.field}>
        <AppText variant="caption" tone="muted">
          Runs until
        </AppText>
        <AppInput
          value={expiresAt}
          onChangeText={setExpiresAt}
          placeholder="2026-09-08T00:00:00Z"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Promotion end date"
        />
        <AppText variant="caption" tone="faint">
          Starts as soon as it is approved. Maximum run is 180 days.
        </AppText>
        {windowError ? (
          <AppText variant="caption" tone="danger">
            {windowError}
          </AppText>
        ) : null}
      </View>

      <AppButton onPress={handleSubmit} disabled={!canSubmit} loading={claimMutation.isPending}>
        Submit for review
      </AppButton>
    </Screen>
  );
}

function defaultExpiry() {
  return new Date(Date.now() + DEFAULT_PROMOTION_DAYS * 86_400_000).toISOString().replace(/\.\d+Z$/, 'Z');
}

function getClaimError(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 429 || error.code === 'AUTH_RATE_LIMITED') {
      return 'You have submitted a few already. Try again a bit later.';
    }

    if (error.status === 404) {
      return 'That place could not be found. Go back and pick it again.';
    }

    // INVALID_FIELDS names the specific problem in its message, so it is passed
    // through rather than flattened into a generic line.
    return error.message;
  }

  return error instanceof Error ? error.message : 'Could not submit the claim right now.';
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
  matches: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    overflow: 'hidden',
  },
  match: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  matchText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    padding: spacing.md,
  },
  selectedName: {
    flex: 1,
    minWidth: 0,
  },
  promotionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  promotionInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  pressed: {
    opacity: 0.7,
  },
});
