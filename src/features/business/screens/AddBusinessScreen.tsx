import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Store } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';

import { ApiRequestError } from '../../../api/client';
import {
  BUSINESS_KINDS,
  BUSINESS_NAME_MAX_LENGTH,
  submitBusinessListing,
} from '../../../api/business';
import { AppButton, AppInput, AppText, BackButton, ErrorBanner, Screen } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { hapticSelection, hapticSuccess } from '../../../utils/haptics';
import { BusinessLocationField } from '../components/BusinessLocationField';
import { useBusinessLocation } from '../hooks/useBusinessLocation';
import { useDebouncedValue } from '../../search/hooks/useDebouncedValue';

/**
 * Submitting a business that is not on the map yet.
 *
 * Nothing here goes live on submit — everything lands in a review queue — so
 * the screen says "submitted for review" throughout and never "added".
 */
export function AddBusinessScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<string>('shop');
  const [phone, setPhone] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const businessLocation = useBusinessLocation();
  const debouncedLocationQuery = useDebouncedValue(locationQuery, 300);
  const { search: searchLocations } = businessLocation;

  // Debounced rather than fired per keystroke: this is a type-ahead against a
  // public endpoint that is IP-throttled.
  useEffect(() => {
    void searchLocations(debouncedLocationQuery);
  }, [debouncedLocationQuery, searchLocations]);

  const submitMutation = useMutation({
    mutationFn: submitBusinessListing,
    onSuccess: () => {
      hapticSuccess();
      setSubmitted(true);
    },
  });

  const trimmedName = name.trim();
  const canSubmit =
    trimmedName.length > 0 &&
    trimmedName.length <= BUSINESS_NAME_MAX_LENGTH &&
    businessLocation.location !== null &&
    !submitMutation.isPending;

  const handleSubmit = () => {
    if (!businessLocation.location || !canSubmit) {
      return;
    }

    submitMutation.mutate({
      name: trimmedName,
      kind,
      lat: businessLocation.location.lat,
      lng: businessLocation.location.lng,
      ...(phone.trim() ? { phone: phone.trim() } : {}),
    });
  };

  if (submitted) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackButton />

        <View style={styles.successCard}>
          <Store color={colors.primaryLight} size={28} />
          <AppText variant="subtitle">Thanks — we have it</AppText>
          <AppText variant="body" tone="muted">
            {trimmedName} is in the review queue. It appears on the map once someone on our side approves
            it, which is why you will not see it there yet.
          </AppText>
        </View>

        <AppButton onPress={() => router.back()}>Done</AppButton>
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
        <BackButton />

      <AppText variant="body" tone="muted">
        Put your shop, stall or service on the AfriHex map. Submissions are reviewed before they go live.
      </AppText>

      {submitMutation.error ? <ErrorBanner message={getSubmitError(submitMutation.error)} /> : null}

      <View style={styles.field}>
        <AppText variant="caption" tone="muted">
          Business name
        </AppText>
        <AppInput
          value={name}
          onChangeText={setName}
          placeholder="Ama's Provisions"
          maxLength={BUSINESS_NAME_MAX_LENGTH}
          accessibilityLabel="Business name"
        />
        <AppText variant="caption" tone="faint">
          {trimmedName.length}/{BUSINESS_NAME_MAX_LENGTH}
        </AppText>
      </View>

      <View style={styles.field}>
        <AppText variant="caption" tone="muted">
          What kind of place is it?
        </AppText>
        <View style={styles.kinds}>
          {BUSINESS_KINDS.map((option) => {
            const selected = option.value === kind;

            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={option.label}
                onPress={() => {
                  setKind(option.value);
                  hapticSelection();
                }}
                style={({ pressed }) => [
                  styles.kind,
                  selected && styles.kindSelected,
                  pressed && styles.pressed,
                ]}
              >
                <AppText variant="caption" tone={selected ? 'primary' : 'muted'}>
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.field}>
        <AppText variant="caption" tone="muted">
          Where is it?
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
          Phone (optional)
        </AppText>
        <AppInput
          value={phone}
          onChangeText={setPhone}
          placeholder="+233 20 123 4567"
          keyboardType="phone-pad"
          autoComplete="tel"
          accessibilityLabel="Contact phone"
        />
        <AppText variant="caption" tone="faint">
          Only used if we need to follow up on your submission — never published.
        </AppText>
      </View>

      <AppButton onPress={handleSubmit} disabled={!canSubmit} loading={submitMutation.isPending}>
        Submit for review
      </AppButton>
    </Screen>
  );
}

/** The rate limit is a real answer, not a failure — it gets its own wording. */
function getSubmitError(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 429) {
      return 'You have submitted a few already. Try again a bit later.';
    }

    switch (error.code) {
      case 'MISSING_FIELDS':
        return 'Add a name and choose what kind of place it is.';
      case 'NAME_TOO_LONG':
        return `The name has to be ${BUSINESS_NAME_MAX_LENGTH} characters or fewer.`;
      case 'COORDS_INVALID':
        return 'That location does not look right. Pick it again.';
      default:
        return error.message;
    }
  }

  return error instanceof Error ? error.message : 'Could not submit right now.';
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  kinds: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kind: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: spacing.md,
  },
  kindSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  successCard: {
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
});
