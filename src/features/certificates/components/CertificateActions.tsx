import { useState } from 'react';
import { Linking, Platform, Share, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Copy, ExternalLink, Share2 } from 'lucide-react-native';

import { AppButton, ErrorBanner } from '../../../components';
import { colors } from '../../../constants/colors';
import { spacing } from '../../../constants/spacing';
import { buildCertificateShareUrl } from '../../../api/certificates';
import { CertificatePdfAction } from './CertificatePdfAction';

type CertificateActionsProps = {
  certificateId: string;
  revoked: boolean;
  /** The verified address, when the viewer is entitled to see it. */
  coordinates?: { lat: number; lng: number };
  onToast: (message: string) => void;
};

export function CertificateActions({
  certificateId,
  revoked,
  coordinates,
  onToast,
}: CertificateActionsProps) {
  const [error, setError] = useState<string | null>(null);

  const shareLink = async () => {
    setError(null);

    try {
      // The public web page, not the API's /verify URL — that returns JSON, and
      // a link a person receives has to land somewhere they can read.
      await Share.share({ message: buildCertificateShareUrl(certificateId) });
    } catch {
      setError('The link could not be shared.');
    }
  };

  const copyId = async () => {
    setError(null);

    try {
      await Clipboard.setStringAsync(certificateId);
      onToast('Certificate ID copied');
    } catch {
      setError('The certificate ID could not be copied.');
    }
  };

  const openInMaps = async () => {
    if (!coordinates) {
      return;
    }

    setError(null);

    try {
      await Linking.openURL(buildMapsUrl(coordinates));
    } catch {
      setError('No maps app could open this address.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.action}>
          <AppButton
            variant="secondary"
            onPress={shareLink}
            icon={<Share2 color={colors.text} size={18} />}
            accessibilityLabel="Share a link to this certificate"
          >
            Share link
          </AppButton>
        </View>
        <View style={styles.action}>
          <AppButton
            variant="secondary"
            onPress={copyId}
            icon={<Copy color={colors.text} size={18} />}
            accessibilityLabel="Copy the certificate ID"
          >
            Copy ID
          </AppButton>
        </View>
      </View>

      {coordinates ? (
        <AppButton
          variant="ghost"
          onPress={openInMaps}
          icon={<ExternalLink color={colors.text} size={18} />}
          accessibilityLabel="Open the verified address in your maps app"
        >
          Open in Maps
        </AppButton>
      ) : null}

      <CertificatePdfAction certificateId={certificateId} revoked={revoked} />

      {error ? <ErrorBanner message={error} /> : null}
    </View>
  );
}

/**
 * Apple Maps on iOS, the geo: intent on Android — each platform's own handler,
 * rather than forcing everyone through one vendor's website.
 */
function buildMapsUrl({ lat, lng }: { lat: number; lng: number }) {
  const coordinates = `${lat},${lng}`;

  return Platform.select({
    ios: `http://maps.apple.com/?ll=${coordinates}&q=${encodeURIComponent('Verified address')}`,
    default: `geo:${coordinates}?q=${coordinates}`,
  });
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
});
