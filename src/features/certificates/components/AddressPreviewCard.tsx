import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Crosshair, MapPin, TriangleAlert } from 'lucide-react-native';

import { AppButton, AppText } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { CertificateAddressMap } from './CertificateAddressMap';
import { formatMetres, formatScoreAsPercent } from '../utils/certificateFormatting';
import type { AddressTarget } from '../hooks/useAddressTarget';

type AddressPreviewCardProps = {
  target: AddressTarget | null;
  isResolving: boolean;
  isLocating: boolean;
  onUseCurrentLocation: () => void;
};

/** A loose fix is the difference between a passing and a failing check. */
const LOOSE_ACCURACY_M = 50;

/**
 * The subject of the screen: where the check is about to be recorded. Empty, it
 * carries the fastest way to fill it in — most people will not have their GPS
 * code memorised, and asking them to type one into a blank form is the slow
 * path dressed up as the default.
 */
export function AddressPreviewCard({
  target,
  isResolving,
  isLocating,
  onUseCurrentLocation,
}: AddressPreviewCardProps) {
  if (isLocating) {
    return (
      <Placeholder>
        <ActivityIndicator color={colors.primaryLight} />
        <AppText variant="caption" tone="muted">
          Finding your location
        </AppText>
      </Placeholder>
    );
  }

  if (!target) {
    return (
      <Placeholder>
        <MapPin color={colors.faint} size={26} />
        <AppText variant="bodyStrong" align="center">
          Where are you right now?
        </AppText>
        <AppText variant="caption" tone="muted" align="center" style={styles.placeholderBody}>
          {isResolving ? 'Looking up that code…' : 'Use your location, or type your GPS code below.'}
        </AppText>
        <AppButton
          variant="secondary"
          onPress={onUseCurrentLocation}
          icon={<Crosshair color={colors.text} size={18} />}
        >
          Use my location
        </AppButton>
      </Placeholder>
    );
  }

  const accuracy = formatMetres(target.accuracyM);
  const quality = formatScoreAsPercent(target.qualityScore);
  const isLoose = typeof target.accuracyM === 'number' && target.accuracyM > LOOSE_ACCURACY_M;

  return (
    <View style={styles.card}>
      <CertificateAddressMap lat={target.lat} lng={target.lng} />

      <View style={styles.footer}>
        <View style={styles.footerText}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {target.label ?? target.gpsCode ?? 'Selected point'}
          </AppText>
          {target.area ? (
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {target.area}
            </AppText>
          ) : null}
        </View>
        {quality ? (
          <AppText variant="code" tone="primary">
            {quality}
          </AppText>
        ) : null}
      </View>

      {isLoose ? (
        // Surfaced before the check, not after: at this accuracy the server may
        // record a failure the user could have avoided by moving outside first.
        <View style={styles.warning} accessibilityRole="alert">
          <TriangleAlert color={colors.gold} size={16} />
          <AppText variant="caption" tone="muted" style={styles.warningText}>
            Your location is only accurate to about {accuracy}. Move into the open before
            verifying, or the check may not pass.
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function Placeholder({ children }: { children: ReactNode }) {
  return <View style={[styles.card, styles.placeholder]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.md,
    gap: spacing.md,
  },
  placeholder: {
    minHeight: 208,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  placeholderBody: {
    maxWidth: 260,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  footerText: {
    flex: 1,
    gap: 2,
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
});
