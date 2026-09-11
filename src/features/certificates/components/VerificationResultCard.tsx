import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleHelp,
  CircleX,
  RotateCcw,
} from 'lucide-react-native';

import { AppButton, AppText } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import type { KycVerificationResult } from '../../../api/kyc';
import { formatEnumValue, formatMetres, formatScoreAsPercent } from '../utils/certificateFormatting';
import { CertificateAddressMap } from './CertificateAddressMap';
import { OptionalRow } from './DetailSection';
import { HexcodeLandmarks } from './HexcodeLandmarks';

type VerificationResultCardProps = {
  result: KycVerificationResult;
  onVerifyAnother: () => void;
};

/**
 * The outcome of the check — not of the certificate. A certificate is issued for
 * failed attempts too, so the verdict is read from `verified` and never inferred
 * from one existing.
 *
 * Ordered by what someone actually came for: did it pass, which address, and
 * where is my certificate. The measurements behind that verdict are forensic —
 * they matter to whoever disputes the result, not to the person reading it — so
 * they sit behind a disclosure rather than between the verdict and the button.
 */
export function VerificationResultCard({ result, onVerifyAnother }: VerificationResultCardProps) {
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const outcome = outcomePresentation(result);
  const certificate = result.certificate;
  const { lat, lng } = result;

  // The outcome replaces the form rather than being pushed, so nothing announces
  // it on its own. The haptic carries the same verdict for anyone who has looked
  // away — success and warning are distinct patterns, not one buzz.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${outcome.status}. ${outcome.headline}.`);

    void Haptics.notificationAsync(
      result.verified === true
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
    // Fires once per result, not on every re-render of the same one.
  }, [outcome.headline, outcome.status, result.verified]);

  return (
    <View style={styles.container}>
      <View style={styles.hero} accessibilityRole="summary">
        <View style={[styles.heroIcon, { borderColor: outcome.accent }]}>{outcome.icon}</View>
        <AppText variant="overline" style={{ color: outcome.accent }}>
          {outcome.status}
        </AppText>

        <AddressIdentity result={result} />

        <AppText variant="caption" tone="muted" align="center" style={styles.heroBody}>
          {outcome.body}
        </AppText>
      </View>

      {certificate ? (
        <AppButton
          onPress={() => router.push(`/certificate/${certificate.id}`)}
          icon={<BadgeCheck color={colors.onPrimary} size={18} />}
        >
          View signed certificate
        </AppButton>
      ) : (
        // `certificate` is omitempty and its absence is normal — signing may be
        // off, or issuance may have failed while the check itself succeeded.
        <AppText variant="caption" tone="faint" align="center">
          No certificate was issued for this check. The result above still stands.
        </AppText>
      )}

      <View style={styles.details}>
        <Pressable
          onPress={() => setDetailsOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityLabel="Check details"
          accessibilityState={{ expanded: detailsOpen }}
          android_ripple={{ color: colors.pressedLayer }}
          style={styles.detailsHeader}
        >
          <AppText variant="caption" tone="muted" style={styles.detailsLabel}>
            Check details
          </AppText>
          {detailsOpen ? (
            <ChevronUp color={colors.muted} size={18} />
          ) : (
            <ChevronDown color={colors.muted} size={18} />
          )}
        </Pressable>

        {detailsOpen ? (
          <View style={styles.detailsBody}>
            {/* Only when the response carried a point. The app never geocodes the
                address itself to fill this in. */}
            {typeof lat === 'number' && typeof lng === 'number' ? (
              <CertificateAddressMap lat={lat} lng={lng} />
            ) : null}

            <View style={styles.rows}>
              <OptionalRow label="Hex address" value={result.hex_code} mono />
              <OptionalRow label="GPS code" value={result.ghanapost_code} mono />
              {/* Measurements run monospaced so the numbers line up in a column
                  and do not jump width between one check and the next. */}
              <OptionalRow label="Quality" value={formatScoreAsPercent(result.quality_score)} mono />
              <OptionalRow
                label="Confidence"
                value={formatScoreAsPercent(result.confidence)}
                mono
              />
              <OptionalRow
                label="Distance from address"
                value={formatMetres(result.device_distance_m)}
                mono
              />
              <OptionalRow label="GPS accuracy" value={formatMetres(result.gps_accuracy_m)} mono />
              <OptionalRow label="Spoof risk" value={formatEnumValue(result.spoof_risk)} mono />
            </View>

            {/* The hex code is the only one the app ever holds, so this is the
                one screen that can answer "what is actually at this address". */}
            {result.hex_code ? <HexcodeLandmarks hexCode={result.hex_code} /> : null}
          </View>
        ) : null}
      </View>

      <AppButton
        variant="ghost"
        onPress={onVerifyAnother}
        icon={<RotateCcw color={colors.text} size={18} />}
      >
        Verify another address
      </AppButton>
    </View>
  );
}

/**
 * The address itself, at the size it deserves — this is the thing the whole
 * flow exists to produce, and a code is read character by character, so it gets
 * the monospaced hero treatment rather than a row in a table.
 *
 * The GPS code leads because it is the short one people quote to each other. A
 * hex address is 21 characters and would have to shrink to fit.
 */
function AddressIdentity({ result }: { result: KycVerificationResult }) {
  const code = result.ghanapost_code ?? result.hex_code;
  const area = [result.area, result.district, result.region].filter(Boolean).join(' · ');

  if (!code) {
    return area ? (
      <AppText variant="subtitle" align="center">
        {area}
      </AppText>
    ) : null;
  }

  return (
    <View style={styles.identity}>
      <AppText
        variant="codeHero"
        align="center"
        numberOfLines={1}
        adjustsFontSizeToFit
        // Read as one code, not as separate letters and numbers.
        accessibilityLabel={`Address code ${code.split('').join(' ')}`}
      >
        {code}
      </AppText>
      {area ? (
        <AppText variant="caption" tone="muted" align="center">
          {area}
        </AppText>
      ) : null}
    </View>
  );
}

function outcomePresentation(result: KycVerificationResult) {
  const distance = formatMetres(result.device_distance_m);

  if (result.verified === true) {
    return {
      status: 'Verified',
      accent: colors.success,
      icon: <CircleCheck color={colors.success} size={28} />,
      headline: 'You are at this address',
      body: distance
        ? `Your device was ${distance} from this address. The check is recorded and signed.`
        : 'Your device was matched to this address. The check is recorded and signed.',
    };
  }

  if (result.verified === false) {
    return {
      status: 'Not verified',
      accent: colors.danger,
      icon: <CircleX color={colors.danger} size={28} />,
      headline: 'Your device is not at this address',
      body: distance
        ? `Your device was ${distance} from this address, which was not close enough. Go to the address and try again.`
        : 'Your device could not be matched to this address. Go to the address and try again.',
    };
  }

  // Never guess a verdict. A missing outcome is reported as missing rather than
  // defaulting to a pass or a fail, either of which would be a lie.
  return {
    status: 'Recorded',
    accent: colors.muted,
    icon: <CircleHelp color={colors.muted} size={28} />,
    headline: 'The check was recorded',
    body: 'The server did not return an outcome for it, so we cannot tell you whether it passed.',
  };
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    // Neutral. The verdict colour lives on the icon ring and the status word, so
    // it never competes with the green of the primary button below it.
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
    borderWidth: 1,
    backgroundColor: colors.cardAlt,
  },
  identity: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  heroBody: {
    maxWidth: 300,
  },
  details: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  detailsLabel: {
    flex: 1,
  },
  detailsBody: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  rows: {
    gap: spacing.md,
  },
});
