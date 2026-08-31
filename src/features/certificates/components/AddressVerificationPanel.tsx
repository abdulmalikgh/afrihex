import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppButton, AppText, ErrorBanner } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { useAddressVerification, type VerificationTarget } from '../hooks/useAddressVerification';
import { useDeviceLocation } from '../hooks/useDeviceLocation';
import { VerificationConfirm } from './VerificationConfirm';
import { VerificationMethodPicker, type VerificationMethod } from './VerificationMethodPicker';
import { VerificationResultCard } from './VerificationResultCard';

type AddressVerificationPanelProps = {
  /** Called once the outcome replaces the form, so the screen can scroll to it. */
  onResult?: () => void;
};

/**
 * Verifying your own address, staged as pick → confirm → result.
 *
 * One question at a time, because this is not a lookup: it writes a record
 * against the account and mints a signed certificate. The two inputs are the
 * device fix and a typed GPS code — the endpoint accepts four methods, but the
 * other two have no mobile use case.
 *
 * Nothing here resolves an address before the check. The device fix is already
 * coordinates, and a typed code is named by the verification response itself, so
 * the whole flow talks to one endpoint and no other.
 */
export function AddressVerificationPanel({ onResult }: AddressVerificationPanelProps) {
  const [method, setMethod] = useState<VerificationMethod | null>(null);
  const [gpsCode, setGpsCode] = useState('');
  const location = useDeviceLocation();
  const { state, verify, reset } = useAddressVerification();

  const submitting = state.status === 'submitting';
  const hasResult = state.status === 'success';

  useEffect(() => {
    if (hasResult) {
      onResult?.();
    }
  }, [hasResult, onResult]);

  const choose = (next: VerificationMethod) => {
    setMethod(next);

    if (next === 'gps_fix') {
      void location.locate();
    }
  };

  // Back keeps whatever was typed. Coming back to a field you already filled and
  // finding it empty is a small betrayal, and the code is not cheap to retype.
  const goBack = () => {
    setMethod(null);
    reset();
  };

  const startOver = () => {
    setMethod(null);
    setGpsCode('');
    location.reset();
    reset();
  };

  const submit = () => {
    const target = buildTarget(method, gpsCode, location.fix);

    if (target) {
      void verify(target);
    }
  };

  if (state.status === 'success') {
    return <VerificationResultCard result={state.result} onVerifyAnother={startOver} />;
  }

  return (
    <View style={styles.container}>
      <StepProgress step={method ? 2 : 1} label={method ? 'Confirm and verify' : 'Choose a method'} />

      {method ? (
        <>
          <VerificationConfirm
            method={method}
            fix={location.fix}
            isLocating={location.isLocating}
            locationError={location.error}
            gpsCode={gpsCode}
            onChangeCode={(value) => {
              setGpsCode(value);
              reset();
            }}
            onRetryLocation={() => {
              reset();
              void location.locate();
            }}
            onBack={goBack}
            onVerify={submit}
            submitting={submitting}
          />

          {state.status === 'error' ? (
            <View style={styles.failure}>
              <ErrorBanner message={state.message} />
              {state.kind === 'session' ? <SignInAgainButton /> : null}
            </View>
          ) : null}
        </>
      ) : (
        <VerificationMethodPicker onChoose={choose} isLocating={location.isLocating} />
      )}
    </View>
  );
}

/**
 * Two steps is few enough to be worth showing and too few to be worth a widget:
 * a filled bar, an empty one, and the name of where you are.
 */
function StepProgress({ step, label }: { step: 1 | 2; label: string }) {
  return (
    <View
      style={styles.progress}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of 2: ${label}`}
      accessibilityValue={{ min: 1, max: 2, now: step }}
    >
      <View style={styles.progressTrack}>
        <View style={styles.progressFilled} />
        <View style={[styles.progressSegment, step === 2 && styles.progressFilled]} />
      </View>
      <AppText variant="overline" tone="muted">
        Step {step} of 2 · {label}
      </AppText>
    </View>
  );
}

function buildTarget(
  method: VerificationMethod | null,
  gpsCode: string,
  fix: ReturnType<typeof useDeviceLocation>['fix'],
): VerificationTarget | null {
  if (method === 'gps_fix') {
    return fix ? { method: 'gps_fix', lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM } : null;
  }

  const trimmed = gpsCode.trim();

  return method === 'gps_code' && trimmed ? { method: 'gps_code', gpsCode: trimmed } : null;
}

function SignInAgainButton() {
  const router = useRouter();

  return (
    <AppButton variant="secondary" onPress={() => router.push('/auth/login')}>
      Sign in again
    </AppButton>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  progress: {
    gap: spacing.sm,
  },
  progressTrack: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: radius.round,
    backgroundColor: colors.border,
  },
  progressFilled: {
    flex: 1,
    height: 3,
    borderRadius: radius.round,
    backgroundColor: colors.primary,
  },
  failure: {
    gap: spacing.md,
  },
});
