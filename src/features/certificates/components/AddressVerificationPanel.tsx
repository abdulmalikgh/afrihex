import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BadgeCheck, CircleCheck, CircleHelp, CircleX, Crosshair } from 'lucide-react-native';

import { AppButton, AppInput, AppText, ErrorBanner, LoadingState } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import type { KycVerificationResult } from '../../../api/kyc';
import { useAddressTarget } from '../hooks/useAddressTarget';
import { useAddressVerification } from '../hooks/useAddressVerification';
import { AddressPreviewCard } from './AddressPreviewCard';
import { OptionalRow } from './DetailSection';
import { formatEnumValue, formatMetres, formatScoreAsPercent } from '../utils/certificateFormatting';

/**
 * Verifying your own address. Two inputs and no more — a GPS code, or the device
 * fix. The endpoint accepts four methods, but the other two have no mobile use
 * case and would be surface area for nothing.
 *
 * The map is not a third input: it cannot be tapped. It is there because
 * verifying is not a lookup — it writes a record against the user's account and
 * mints a signed certificate — so it is worth showing them the point first.
 */
export function AddressVerificationPanel() {
  const [gpsCode, setGpsCode] = useState('');
  const {
    target,
    isResolving,
    resolveFailed,
    isLocating,
    locationError,
    useCurrentLocation,
    clearFix,
  } = useAddressTarget(gpsCode);
  const { state, verify, reset } = useAddressVerification();

  const submitting = state.status === 'submitting';

  const editCode = (value: string) => {
    setGpsCode(value);
    clearFix();
    reset();
  };

  const locate = () => {
    setGpsCode('');
    reset();
    void useCurrentLocation();
  };

  return (
    <View style={styles.container}>
      <AddressPreviewCard
        target={target}
        isResolving={isResolving}
        isLocating={isLocating}
        onUseCurrentLocation={locate}
      />

      <View style={styles.inputRow}>
        <AppInput
          value={gpsCode}
          onChangeText={editCode}
          placeholder="GPS code (e.g. GA-142-7281)"
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          editable={!submitting}
          returnKeyType="done"
          accessibilityLabel="GPS code"
          style={styles.input}
        />
        {/* Mirrors the scan button on the certificate tab, so the two panels
            share one shape: a field, and the shortcut that fills it for you. */}
        <Pressable
          onPress={locate}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Use my current location"
          style={styles.locateButton}
        >
          <Crosshair color={colors.text} size={22} />
        </Pressable>
      </View>

      {locationError ? <ErrorBanner message={locationError} /> : null}
      {resolveFailed ? (
        <AppText variant="caption" tone="muted">
          No address matches that code. Check the characters, or use your location instead.
        </AppText>
      ) : null}

      <AppButton onPress={() => target && void verify(target)} disabled={!target || submitting} loading={submitting}>
        Verify this address
      </AppButton>

      <AppText variant="caption" tone="faint" align="center">
        We record the check and issue a signed certificate you can share.
      </AppText>

      {state.status === 'submitting' ? <LoadingState label="Verifying the address" /> : null}
      {state.status === 'error' ? (
        <View style={styles.failure}>
          <ErrorBanner message={state.message} />
          {state.kind === 'session' ? <SignInAgainButton /> : null}
        </View>
      ) : null}
      {state.status === 'success' ? <VerificationResultCard result={state.result} /> : null}
    </View>
  );
}

/**
 * The outcome of the check — not of the certificate. A certificate is issued
 * either way, so this reports `verified` and never infers a pass from one
 * existing.
 */
function VerificationResultCard({ result }: { result: KycVerificationResult }) {
  const router = useRouter();
  const outcome = outcomePresentation(result.verified);
  const certificate = result.certificate;

  return (
    <View style={[styles.card, { borderColor: outcome.accent }]}>
      <View style={styles.outcome}>
        {outcome.icon}
        <AppText variant="bodyStrong" style={[styles.outcomeText, { color: outcome.accent }]}>
          {outcome.label}
        </AppText>
      </View>

      <View style={styles.rows}>
        <OptionalRow label="Hex address" value={result.hex_code} mono />
        <OptionalRow label="GPS code" value={result.ghanapost_code} mono />
        <OptionalRow
          label="Area"
          value={[result.area, result.district, result.region].filter(Boolean).join(' · ') || undefined}
        />
        <OptionalRow label="Quality" value={formatScoreAsPercent(result.quality_score)} />
        <OptionalRow label="Confidence" value={formatScoreAsPercent(result.confidence)} />
        <OptionalRow label="Distance from address" value={formatMetres(result.device_distance_m)} />
        <OptionalRow label="Spoof risk" value={formatEnumValue(result.spoof_risk)} mono />
      </View>

      {certificate ? (
        <AppButton
          variant="secondary"
          onPress={() => router.push(`/certificate/${certificate.id}`)}
          icon={<BadgeCheck color={colors.text} size={18} />}
        >
          View signed certificate
        </AppButton>
      ) : (
        // `certificate` is omitempty and its absence is normal — signing may be
        // off, or issuance may have failed while the check itself succeeded.
        <AppText variant="caption" tone="faint">
          No certificate was issued for this check.
        </AppText>
      )}
    </View>
  );
}

function SignInAgainButton() {
  const router = useRouter();

  return (
    <AppButton variant="secondary" onPress={() => router.push('/auth/login')}>
      Sign in again
    </AppButton>
  );
}

function outcomePresentation(verified: boolean | undefined) {
  if (verified === true) {
    return {
      label: 'Verified — device at this address',
      accent: colors.primaryLight,
      icon: <CircleCheck color={colors.primaryLight} size={20} />,
    };
  }

  if (verified === false) {
    return {
      label: 'Not verified — device not at this address',
      accent: colors.danger,
      icon: <CircleX color={colors.danger} size={20} />,
    };
  }

  // Never guess a verdict. A missing outcome field is reported as missing
  // rather than defaulting to a pass or a fail, either of which would be a lie.
  return {
    label: 'Check recorded — outcome unavailable',
    accent: colors.muted,
    icon: <CircleHelp color={colors.muted} size={20} />,
  };
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
  },
  locateButton: {
    width: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBg,
  },
  card: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  outcome: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  outcomeText: {
    flex: 1,
  },
  rows: {
    gap: spacing.md,
  },
  failure: {
    gap: spacing.md,
  },
});
