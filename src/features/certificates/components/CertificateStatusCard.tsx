import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { FileQuestion, ShieldAlert, ShieldCheck, ShieldX, WifiOff } from 'lucide-react-native';

import { AppText } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import type { CertificateVerification } from '../../../api/certificates';
import { formatCertificateDate, formatCertificateTimestamp } from '../utils/certificateStatus';

/**
 * The verdict on the *document*: is it authentic and still standing. It does
 * not say whether the person was where they claimed — a certificate is issued
 * for failed verifications too, so that answer lives in the subject section
 * below and the two must never be read off one indicator.
 */
export type CertificateHeroStatus =
  | 'valid'
  | 'revoked'
  | 'signature_invalid'
  | 'not_found'
  | 'error';

type CertificateStatusCardProps = {
  status: CertificateHeroStatus;
  verification?: CertificateVerification;
};

export function CertificateStatusCard({ status, verification }: CertificateStatusCardProps) {
  const presentation = heroPresentation[status];
  const detail = buildDetail(status, verification);

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${presentation.eyebrow}. ${presentation.title}. ${detail}`}
      style={[styles.card, { borderColor: presentation.accent }]}
    >
      <View style={[styles.badge, { backgroundColor: presentation.badgeColor }]}>
        {presentation.icon}
      </View>

      {/* The state is named in words as well as colour and icon — a red card and
          a green card are the same card to a colourblind reader, and this is the
          one screen where confusing them matters. */}
      <AppText variant="overline" align="center" style={{ color: presentation.accent }}>
        {presentation.eyebrow}
      </AppText>
      <AppText variant="subtitle" align="center">
        {presentation.title}
      </AppText>
      <AppText variant="caption" tone="muted" align="center" style={styles.detail}>
        {detail}
      </AppText>
    </View>
  );
}

type HeroPresentation = {
  eyebrow: string;
  title: string;
  body: string;
  accent: string;
  badgeColor: string;
  icon: ReactNode;
};

const heroPresentation: Record<CertificateHeroStatus, HeroPresentation> = {
  valid: {
    eyebrow: 'Authentic',
    title: 'This certificate is genuine',
    body: 'The signature is cryptographically valid and the certificate has not been revoked.',
    accent: colors.primaryLight,
    badgeColor: colors.primary,
    icon: <ShieldCheck color={colors.white} size={30} />,
  },
  revoked: {
    eyebrow: 'Revoked',
    title: 'This certificate has been revoked',
    body: 'It was revoked by the issuer.',
    accent: colors.danger,
    badgeColor: colors.danger,
    icon: <ShieldX color={colors.white} size={30} />,
  },
  signature_invalid: {
    eyebrow: 'Not authentic',
    title: 'This certificate failed verification',
    body: "The signature does not match the issuer's public key, or the record is malformed. Do not rely on this certificate.",
    accent: colors.gold,
    badgeColor: colors.gold,
    icon: <ShieldAlert color={colors.surface} size={30} />,
  },
  not_found: {
    eyebrow: 'Not found',
    title: 'Certificate not found',
    body: 'No certificate exists with that ID. It may never have been issued, or the link is mistyped.',
    accent: colors.muted,
    badgeColor: colors.cardAlt,
    icon: <FileQuestion color={colors.muted} size={30} />,
  },
  error: {
    eyebrow: 'Unavailable',
    title: 'Verification unavailable',
    body: 'The verification service could not be reached. Please try again.',
    accent: colors.muted,
    badgeColor: colors.cardAlt,
    icon: <WifiOff color={colors.muted} size={30} />,
  },
};

function buildDetail(status: CertificateHeroStatus, verification?: CertificateVerification) {
  const { body } = heroPresentation[status];

  if (status === 'valid') {
    const issued = formatCertificateDate(verification?.issued_at);

    return issued ? `${body} Issued on ${issued}.` : body;
  }

  if (status === 'revoked') {
    const revokedAt = formatCertificateTimestamp(verification?.revoked_at);
    const reason = verification?.revoke_reason;

    return [body, revokedAt && `Revoked on ${revokedAt}.`, reason && `Reason: ${reason}`]
      .filter(Boolean)
      .join(' ');
  }

  return body;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: colors.card,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  detail: {
    maxWidth: 340,
  },
});
