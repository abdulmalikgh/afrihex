import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScanLine } from 'lucide-react-native';

import { AppButton, AppInput, AppText, Screen, SegmentedControl } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { useAuthSession } from '../../authentication/context/AuthSessionProvider';
import { AddressVerificationPanel } from '../components/AddressVerificationPanel';
import { CertificateScannerModal } from '../components/CertificateScannerModal';
import { normalizeCertificateId } from '../utils/certificateId';

type VerifyMode = 'address' | 'certificate';

// Short enough to survive the segment at 11px on a 375pt screen. The subtitle
// below the title carries the fuller explanation.
const MODES = [
  { label: 'My address', value: 'address' as const },
  { label: 'A certificate', value: 'certificate' as const },
];

/**
 * Two jobs share this tab because they share a word, not a workflow.
 *
 * Verifying your own address is the app user's task and needs their session.
 * Checking someone else's certificate is a stranger's task — a bank, a landlord
 * — and is deliberately public. Keeping both reachable means a signed-out
 * visitor can still do the public one.
 */
export function VerifyScreen() {
  const [mode, setMode] = useState<VerifyMode>('address');
  const scrollRef = useRef<ScrollView>(null);

  // The result replaces the form in place, so without this the reader is left
  // partway down an outcome they have not seen the top of.
  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  return (
    <Screen scroll scrollRef={scrollRef} contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="title">Verify</AppText>
        <AppText variant="body" tone="muted">
          {mode === 'address'
            ? 'Prove you are at your address and get a signed certificate for it.'
            : 'Check that a certificate is genuine and has not been revoked.'}
        </AppText>
      </View>

      <SegmentedControl
        options={MODES}
        value={mode}
        onChange={setMode}
        accessibilityLabel="What would you like to verify"
      />

      {mode === 'address' ? <AddressMode onResult={scrollToTop} /> : <CertificateLookup />}
    </Screen>
  );
}

function AddressMode({ onResult }: { onResult: () => void }) {
  const { status } = useAuthSession();
  const router = useRouter();

  // A soft prompt, never a wall — the certificate half of this tab stays usable
  // signed out, so blocking the whole screen would take away something public.
  if (status !== 'authenticated') {
    return (
      <View style={styles.prompt}>
        <AppText variant="subtitle">Sign in to verify your address</AppText>
        <AppText variant="caption" tone="muted">
          Verifying an address records the check against your account and issues a signed
          certificate. Checking someone else&apos;s certificate needs no account.
        </AppText>
        <AppButton onPress={() => router.push('/auth/login')}>Sign in</AppButton>
      </View>
    );
  }

  return <AddressVerificationPanel onResult={onResult} />;
}

function CertificateLookup() {
  const router = useRouter();
  const [certificateId, setCertificateId] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  const open = (rawId: string) => {
    const id = normalizeCertificateId(rawId);

    if (id) {
      // Not encoded here: expo-router escapes the segment, and the API client
      // encodes again when it builds the request. Doing it a third time would
      // hand the server a double-escaped id.
      router.push(`/certificate/${id}`);
    }
  };

  const handleScan = (scannedId: string) => {
    setScannerOpen(false);
    setCertificateId(scannedId);
    open(scannedId);
  };

  return (
    <View style={styles.container}>
      {/* The QR path leads, because the common case is a printed certificate in
          someone's hand — and every certificate PDF carries the code. */}
      <View style={styles.card}>
        <AppText variant="bodyStrong">Scan the certificate</AppText>
        <AppText variant="caption" tone="muted">
          Every printed certificate carries a QR code. Point your camera at it and we will check it
          straight away.
        </AppText>
        <AppButton
          variant="secondary"
          onPress={() => setScannerOpen(true)}
          icon={<ScanLine color={colors.text} size={18} />}
        >
          Scan QR code
        </AppButton>
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <AppText variant="caption" tone="faint">
          or enter the ID
        </AppText>
        <View style={styles.dividerLine} />
      </View>

      <AppInput
        value={certificateId}
        onChangeText={setCertificateId}
        placeholder="cert_GPU4XBpCp7q"
        // IDs are matched exactly, so every keyboard convenience — capitalising
        // the first letter, correcting an apparent typo — would break a valid one.
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        returnKeyType="search"
        onSubmitEditing={() => open(certificateId)}
        accessibilityLabel="Certificate ID"
      />

      <AppButton onPress={() => open(certificateId)} disabled={!certificateId.trim()}>
        Check certificate
      </AppButton>

      <AppText variant="caption" tone="faint" align="center">
        No account needed. Anyone can check any certificate.
      </AppText>

      <CertificateScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleScan}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
  },
  header: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  container: {
    gap: spacing.md,
  },
  card: {
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
  },
  prompt: {
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
});
