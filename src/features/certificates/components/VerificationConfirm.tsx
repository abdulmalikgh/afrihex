import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, Crosshair, ShieldCheck, TriangleAlert } from 'lucide-react-native';

import { AppButton, AppInput, AppText, ErrorBanner } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { formatMetres } from '../utils/certificateFormatting';
import { isCompleteGpsCode } from '../utils/gpsCode';
import type { DeviceFix } from '../hooks/useDeviceLocation';
import type { VerificationMethod } from './VerificationMethodPicker';
import { CertificateAddressMap } from './CertificateAddressMap';

/** Beyond this, the fix is loose enough to fail a check that would otherwise pass. */
const LOOSE_ACCURACY_M = 50;

type VerificationConfirmProps = {
  method: VerificationMethod;
  fix: DeviceFix | null;
  isLocating: boolean;
  locationError: string | null;
  gpsCode: string;
  onChangeCode: (value: string) => void;
  onRetryLocation: () => void;
  onBack: () => void;
  onVerify: () => void;
  submitting: boolean;
};

/**
 * The last screen before anything is written. It shows what is about to be
 * checked and says plainly what the check costs — a record on the account and a
 * signed certificate — so the primary button is never a surprise.
 */
export function VerificationConfirm({
  method,
  fix,
  isLocating,
  locationError,
  gpsCode,
  onChangeCode,
  onRetryLocation,
  onBack,
  onVerify,
  submitting,
}: VerificationConfirmProps) {
  const ready = method === 'gps_fix' ? fix !== null : isCompleteGpsCode(gpsCode);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={onBack}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel="Choose a different method"
        hitSlop={8}
        style={styles.back}
      >
        <ChevronLeft color={colors.muted} size={18} />
        <AppText variant="caption" tone="muted">
          {method === 'gps_fix' ? 'Using my location' : 'Using a GPS code'} · change
        </AppText>
      </Pressable>

      {method === 'gps_fix' ? (
        <LocationTarget
          fix={fix}
          isLocating={isLocating}
          locationError={locationError}
          onRetry={onRetryLocation}
        />
      ) : (
        <CodeTarget value={gpsCode} onChange={onChangeCode} editable={!submitting} />
      )}

      <View style={styles.note}>
        <ShieldCheck color={colors.primaryLight} size={18} />
        <AppText variant="caption" tone="muted" style={styles.noteText}>
          Verifying records this check on your account and issues a signed certificate. A
          certificate is issued either way — it proves the check happened, not that it passed.
        </AppText>
      </View>

      <AppButton onPress={onVerify} disabled={!ready || submitting} loading={submitting}>
        Verify my address
      </AppButton>
    </View>
  );
}

function LocationTarget({
  fix,
  isLocating,
  locationError,
  onRetry,
}: {
  fix: DeviceFix | null;
  isLocating: boolean;
  locationError: string | null;
  onRetry: () => void;
}) {
  if (isLocating) {
    return (
      <View style={[styles.card, styles.placeholder]}>
        <ActivityIndicator color={colors.primaryLight} />
        <AppText variant="caption" tone="muted">
          Finding your location
        </AppText>
      </View>
    );
  }

  if (!fix) {
    return (
      <View style={styles.stack}>
        {locationError ? <ErrorBanner message={locationError} /> : null}
        <AppButton
          variant="secondary"
          onPress={onRetry}
          icon={<Crosshair color={colors.text} size={18} />}
        >
          Try my location again
        </AppButton>
      </View>
    );
  }

  const accuracy = formatMetres(fix.accuracyM);
  const isLoose = typeof fix.accuracyM === 'number' && fix.accuracyM > LOOSE_ACCURACY_M;

  return (
    <View style={styles.card}>
      <CertificateAddressMap lat={fix.lat} lng={fix.lng} />

      <View style={styles.cardFooter}>
        <View style={styles.cardFooterText}>
          <AppText variant="bodyStrong">Your location right now</AppText>
          <AppText variant="caption" tone="muted">
            {accuracy ? `Accurate to about ${accuracy}` : 'Read from your device GPS'}
          </AppText>
        </View>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Read my location again"
          style={styles.refresh}
        >
          <Crosshair color={colors.text} size={18} />
        </Pressable>
      </View>

      {isLoose ? (
        // Before the check, not after: at this accuracy the server may record a
        // failure the user could have avoided by stepping outside first.
        <View style={styles.warning} accessibilityRole="alert">
          <TriangleAlert color={colors.gold} size={16} />
          <AppText variant="caption" tone="muted" style={styles.warningText}>
            That is loose enough to fail the check. Move into the open, then read your location
            again.
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function CodeTarget({
  value,
  onChange,
  editable,
}: {
  value: string;
  onChange: (value: string) => void;
  editable: boolean;
}) {
  return (
    <View style={styles.card}>
      <AppText variant="overline" tone="muted">
        Address GPS code
      </AppText>

      <AppInput
        value={value}
        onChangeText={onChange}
        placeholder="GA-142-7281"
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        autoFocus
        editable={editable}
        returnKeyType="done"
        accessibilityLabel="GPS code"
      />

      <AppText variant="caption" tone="faint">
        Three parts, like GA-142-7281. We check the code when you verify — no map preview until
        then.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  stack: {
    gap: spacing.md,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    // 44pt with the hit slop, so the one control that undoes a committed choice
    // is not the smallest target on the screen.
    minHeight: 36,
    alignSelf: 'flex-start',
    paddingRight: spacing.sm,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.md,
    gap: spacing.md,
  },
  placeholder: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  cardFooterText: {
    flex: 1,
    gap: 2,
  },
  refresh: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cardAlt,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    padding: spacing.md,
  },
  warningText: {
    flex: 1,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  noteText: {
    flex: 1,
  },
});
