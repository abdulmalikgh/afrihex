import { Pressable, StyleSheet, View } from 'react-native';
import { Crosshair } from 'lucide-react-native';

import { AppButton, AppText } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';

export type VerificationMethod = 'gps_fix' | 'gps_code';

type VerificationMethodPickerProps = {
  onChoose: (method: VerificationMethod) => void;
  isLocating: boolean;
};

/**
 * The first step, weighted the way the choice actually falls.
 *
 * Almost everyone verifying an address is standing at it — the device fix is the
 * answer, and typing a code is for the person who is not there. Presenting them
 * as two equal cards would invent a decision, so the fix is the screen's one
 * primary action and the code is a quiet way out of it.
 */
export function VerificationMethodPicker({ onChoose, isLocating }: VerificationMethodPickerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Crosshair color={colors.onPrimary} size={26} />
        </View>

        <AppText variant="subtitle" align="center">
          Verify where you are
        </AppText>

        {/* The whole story in one sentence, so the screen does not have to
            teach a three-step lesson before anyone is allowed to tap. */}
        <AppText variant="caption" tone="muted" align="center" style={styles.heroBody}>
          We match your device against the address you are standing at, record the result, and
          issue a signed certificate you can share.
        </AppText>

        <View style={styles.action}>
          <AppButton
            onPress={() => onChoose('gps_fix')}
            loading={isLocating}
            icon={<Crosshair color={colors.onPrimary} size={18} />}
          >
            Use my location
          </AppButton>
        </View>
      </View>

      <Pressable
        onPress={() => onChoose('gps_code')}
        disabled={isLocating}
        accessibilityRole="button"
        accessibilityLabel="Enter a GPS code instead"
        accessibilityHint="For verifying an address you are not currently at"
        android_ripple={{ color: colors.pressedLayer }}
        style={({ pressed }) => [
          styles.secondary,
          isLocating && styles.secondaryDisabled,
          pressed && styles.secondaryPressed,
        ]}
      >
        <AppText variant="caption" tone="muted">
          I&apos;d rather enter a GPS code
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  heroIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    borderRadius: radius.round,
    backgroundColor: colors.primary,
  },
  heroBody: {
    maxWidth: 300,
  },
  action: {
    alignSelf: 'stretch',
    paddingTop: spacing.md,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    // Full width and 48pt tall: quiet in weight, never small as a target.
    minHeight: 48,
    borderRadius: radius.md,
  },
  secondaryPressed: {
    backgroundColor: colors.hover,
  },
  secondaryDisabled: {
    opacity: 0.5,
  },
});
