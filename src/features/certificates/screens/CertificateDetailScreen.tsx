import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Fingerprint, FileText, MapPin, PenLine, ShieldCheck } from 'lucide-react-native';

import { AppButton, AppText, LoadingState, Screen, Toast } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import type { CertificateDetail } from '../../../api/certificates';
import { CertificateActions } from '../components/CertificateActions';
import { CertificateAddressMap } from '../components/CertificateAddressMap';
import { CertificateStatusCard } from '../components/CertificateStatusCard';
import { DetailRow, DetailSection, OptionalRow } from '../components/DetailSection';
import { useCertificateDetail } from '../hooks/useCertificateDetail';
import {
  formatEnumValue,
  formatMetres,
  formatRiskScore,
  formatScoreAsPercent,
} from '../utils/certificateFormatting';
import { formatCertificateTimestamp } from '../utils/certificateStatus';

/**
 * The server embeds this attestation in every certificate, so the payload's own
 * copy is preferred when we have it. Anonymous viewers never see the payload,
 * and the disclaimer is exactly the audience-facing caveat they most need — so
 * it is carried here too rather than omitted for them.
 */
const CERTIFICATE_DISCLAIMER =
  'This certificate attests that a device was detected within the stated distance of the ' +
  'declared address at the stated time. It does NOT confirm the identity of the device holder, ' +
  'duration of residency, or property ownership. Verification confidence is subject to GPS ' +
  'hardware accuracy and environmental conditions.';

export function CertificateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const certificateId = typeof id === 'string' ? id : '';
  const [toast, setToast] = useState<string | null>(null);
  const { status, verification, detail, isDetailLoading, detailUnavailableReason } =
    useCertificateDetail(certificateId);

  // Cleared through an effect so leaving the screen cancels the timer, rather
  // than letting it set state on an unmounted component.
  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = setTimeout(() => setToast(null), 1400);

    return () => clearTimeout(timeoutId);
  }, [toast]);

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="overline" tone="primary" align="center">
          Signed address certificate
        </AppText>
        <AppText variant="title" align="center">
          Certificate verification
        </AppText>
        <AppText variant="caption" tone="muted" align="center">
          This checks the certificate&apos;s signature against the issuer&apos;s public key and its
          revocation status. Anyone can verify a certificate — no account needed.
        </AppText>
      </View>

      {status === 'loading' ? (
        <LoadingState label="Checking the certificate" />
      ) : (
        <CertificateStatusCard status={status} verification={verification} />
      )}

      {isDetailLoading ? <LoadingState label="Loading certificate details" /> : null}

      {detail ? <CertificateSections detail={detail} /> : null}

      {detailUnavailableReason ? (
        <DetailNotice reason={detailUnavailableReason} />
      ) : null}

      {verification ? (
        <DetailSection title="Certificate details" icon={<FileText color={colors.muted} size={16} />}>
          <DetailRow label="ID" value={verification.certificate_id} mono />
          <OptionalRow
            label="Issued"
            value={formatCertificateTimestamp(verification.issued_at)}
          />
          <OptionalRow label="Issuer" value={verification.issuer} />
          <DetailRow
            label="Signature"
            value={verification.signature_valid ? 'valid' : 'does not match'}
            mono
            tone={verification.signature_valid ? 'default' : 'danger'}
          />
          <OptionalRow label="Signing key" value={verification.signing_key_id} mono />
        </DetailSection>
      ) : null}

      {status !== 'not_found' && status !== 'error' && certificateId ? (
        <CertificateActions
          certificateId={certificateId}
          revoked={status === 'revoked'}
          coordinates={getCoordinates(detail)}
          onToast={setToast}
        />
      ) : (
        <BackToVerify />
      )}

      <AppText variant="caption" tone="faint" style={styles.disclaimer}>
        {detail?.disclaimer ?? CERTIFICATE_DISCLAIMER}
      </AppText>

      <Toast message={toast} />
    </Screen>
  );
}

/**
 * The rich half. Everything here comes from the authenticated payload, and the
 * one row that matters most is "Verification" — whether the device was actually
 * at the address. A genuine certificate can record a failed check, so this must
 * read separately from the authenticity verdict above.
 */
function CertificateSections({ detail }: { detail: CertificateDetail }) {
  const { subject, verification, address, integrity, signature } = detail;
  const verified = verification.verified;

  return (
    <>
      <DetailSection title="Verified subject" icon={<ShieldCheck color={colors.muted} size={16} />}>
        <OptionalRow label="Customer" value={subject.customer_id} mono />
        <OptionalRow label="Declared address" value={subject.declared_address} mono />
        {typeof verified === 'boolean' ? (
          <DetailRow
            label="Verification"
            value={verified ? 'Verified — device at this address' : 'Not verified'}
            tone={verified ? 'primary' : 'danger'}
          />
        ) : null}
        <OptionalRow label="Result" value={formatEnumValue(verification.result)} mono />
        <OptionalRow
          label="Distance from address"
          value={formatMetres(verification.device_distance_m)}
        />
        <OptionalRow label="GPS accuracy" value={formatMetres(verification.gps_accuracy_m)} />
        <OptionalRow label="Confidence" value={formatScoreAsPercent(verification.confidence)} />
        <OptionalRow label="Method" value={verification.method} mono />
        <OptionalRow label="Timestamp" value={formatCertificateTimestamp(verification.timestamp)} />
      </DetailSection>

      <DetailSection title="Verified address" icon={<MapPin color={colors.muted} size={16} />}>
        <OptionalRow label="GPS code" value={address.gps_code} mono />
        <OptionalRow label="Quality" value={formatScoreAsPercent(address.quality_score)} />
        {typeof address.lat === 'number' && typeof address.lng === 'number' ? (
          <CertificateAddressMap lat={address.lat} lng={address.lng} />
        ) : null}
        <OptionalRow
          label="Area"
          value={[address.area, address.district, address.region].filter(Boolean).join(' · ') || undefined}
        />
      </DetailSection>

      <DetailSection
        title="Device integrity at verification"
        icon={<Fingerprint color={colors.muted} size={16} />}
      >
        <OptionalRow label="Spoof risk" value={formatEnumValue(integrity.spoof_risk)} mono />
        <OptionalRow label="Fraud risk score" value={formatRiskScore(integrity.fraud_risk_score)} mono />
        <OptionalRow label="Fraud risk level" value={formatEnumValue(integrity.fraud_risk_level)} mono />
        <OptionalRow
          label="IP–location match"
          value={formatEnumValue(integrity.ip_location_match)}
          mono
        />
      </DetailSection>

      <DetailSection title="Signature" icon={<PenLine color={colors.muted} size={16} />}>
        <OptionalRow label="Algorithm" value={signature.algorithm} mono />
        <OptionalRow label="Key ID" value={signature.kid} mono />
        <OptionalRow label="Signature" value={truncateSignature(signature.signature)} mono />
        <OptionalRow label="Verify URL" value={detail.verification_base_url} mono />
      </DetailSection>
    </>
  );
}

function DetailNotice({ reason }: { reason: 'anonymous' | 'withheld' }) {
  const router = useRouter();

  return (
    <View style={styles.notice}>
      <AppText variant="caption" tone="muted">
        {reason === 'anonymous'
          ? 'Sign in to see the verified subject, address and device integrity recorded on this certificate.'
          : 'The signed subject, address and device details are shown only for valid certificates.'}
      </AppText>
      {reason === 'anonymous' ? (
        <AppButton variant="secondary" onPress={() => router.push('/auth/login')}>
          Sign in
        </AppButton>
      ) : null}
    </View>
  );
}

function BackToVerify() {
  const router = useRouter();

  return (
    <AppButton variant="secondary" onPress={() => router.back()}>
      Check another certificate
    </AppButton>
  );
}

function getCoordinates(detail: CertificateDetail | undefined) {
  const lat = detail?.address.lat;
  const lng = detail?.address.lng;

  return typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : undefined;
}

/** Enough to compare against another copy by eye, without wrapping five lines. */
function truncateSignature(signature: string | undefined) {
  if (!signature) {
    return undefined;
  }

  return signature.length > 48 ? `${signature.slice(0, 48)}…` : signature;
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  notice: {
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    padding: spacing.lg,
  },
  disclaimer: {
    paddingTop: spacing.sm,
  },
});
