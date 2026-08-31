import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { QrCode } from 'lucide-react-native';

import { AppButton, AppInput, AppText, Screen, SegmentedControl } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { useAuthSession } from '../../authentication/context/AuthSessionProvider';
import { AddressVerificationPanel } from '../components/AddressVerificationPanel';
import { CertificateScannerModal } from '../components/CertificateScannerModal';
import { normalizeCertificateId } from '../utils/certificateId';

type VerifyMode = 'address' | 'certificate';

const MODES = [
  { label: 'Verify an address', value: 'address' as const },
  { label: 'Check a certificate', value: 'certificate' as const },
];

/**
 * Two jobs share this tab because they share a word, not a workflow.
 *
 * Verifying your own address is the app user's task and needs their API key.
 * Checking someone else's certificate is a stranger's task — a bank, a landlord
 * — and is deliberately public. Keeping both reachable means a signed-out
 * visitor can still do the public one.
 */
export function VerifyScreen() {
  const [mode, setMode] = useState<VerifyMode>('address');

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="title">Verify</AppText>
        <AppText variant="body" tone="muted">
          Prove you are at your address, or check a certificate someone gave you.
        </AppText>
      </View>

      <SegmentedControl
        options={MODES}
        value={mode}
        onChange={setMode}
        accessibilityLabel="What would you like to verify"
      />

      {mode === 'address' ? <AddressMode /> : <CertificateLookup />}
    </Screen>
  );
}

function AddressMode() {
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

  return <AddressVerificationPanel />;
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
      <AppText variant="caption" tone="muted">
        Enter the certificate ID — in the address-verification email link, or printed on the PDF
        certificate — or scan the QR code on the document.
      </AppText>

      <View style={styles.inputRow}>
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
          style={styles.input}
        />
        <Pressable
          onPress={() => setScannerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Scan a certificate QR code"
          style={styles.scanButton}
        >
          <QrCode color={colors.text} size={22} />
        </Pressable>
      </View>

      <AppButton onPress={() => open(certificateId)} disabled={!certificateId.trim()}>
        Check certificate
      </AppButton>

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
  prompt: {
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
  },
  scanButton: {
    width: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBg,
  },
});
