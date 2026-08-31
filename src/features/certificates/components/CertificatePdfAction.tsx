import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FileText, TriangleAlert } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';

import { AppButton, AppText, ErrorBanner } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { buildCertificatePdfUrl } from '../../../api/certificates';

type CertificatePdfActionProps = {
  certificateId: string;
  /** Drives the caveat about the PDF carrying no revocation marking. */
  revoked: boolean;
};

/**
 * Opens the printable certificate in an in-app browser tab — a Safari sheet on
 * iOS, a Custom Tab on Android — so the reader never leaves AfriHex. The
 * endpoint is public and served inline, so the URL needs no headers and no
 * download step.
 *
 * Every dependency on how the PDF is presented lives in this one component. If
 * an embedded viewer is wanted later, it is this file that changes and nothing
 * else.
 */
export function CertificatePdfAction({ certificateId, revoked }: CertificatePdfActionProps) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPdf = async () => {
    setOpening(true);
    setError(null);

    try {
      await WebBrowser.openBrowserAsync(buildCertificatePdfUrl(certificateId), {
        controlsColor: colors.primaryLight,
        toolbarColor: colors.card,
        dismissButtonStyle: 'close',
        enableBarCollapsing: true,
      });
    } catch {
      setError('The certificate PDF could not be opened. Check your connection and try again.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <View style={styles.container}>
      {revoked ? (
        <View style={styles.caveat} accessible accessibilityRole="alert">
          <TriangleAlert color={colors.gold} size={18} />
          <AppText variant="caption" tone="muted" style={styles.caveatText}>
            The printable certificate carries no revoked marking, so it will look valid. This
            check is the authority, not the document.
          </AppText>
        </View>
      ) : null}

      <AppButton
        variant="secondary"
        onPress={openPdf}
        loading={opening}
        icon={<FileText color={colors.text} size={18} />}
        accessibilityLabel="Open the printable certificate"
      >
        Open certificate PDF
      </AppButton>

      {error ? <ErrorBanner message={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  caveat: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cardAlt,
    padding: spacing.md,
  },
  caveatText: {
    flex: 1,
  },
});
