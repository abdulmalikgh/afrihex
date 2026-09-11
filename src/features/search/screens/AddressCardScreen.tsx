import { useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { Download, Share2 } from 'lucide-react-native';

import { lookupAddress } from '../../../api/search';
import { AppButton, AppText, BackButton, ErrorBanner, LoadingState, Screen } from '../../../components';
import { colors } from '../../../constants/colors';
import { spacing } from '../../../constants/spacing';
import { mapLookupResult } from '../../../utils/resolveAddressQuery';
import { hapticSuccess } from '../../../utils/haptics';
import { AddressCard, buildAddressCardShareText } from '../components/AddressCard';

/**
 * The shareable address card.
 *
 * One API call — resolve the code — and everything after it is local: the card
 * is native UI, captured to a PNG and handed to the platform share sheet. There
 * is no server endpoint that renders a card image, and no endpoint that returns
 * the QR.
 */
export function AddressCardScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const gpsCode = typeof code === 'string' ? code : '';
  const cardRef = useRef<View>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);

  const lookupQuery = useQuery({
    queryKey: ['address-card', gpsCode],
    queryFn: async () => mapLookupResult(await lookupAddress(gpsCode), 'lookup'),
    enabled: gpsCode.length > 0,
    staleTime: 600_000,
  });

  const result = lookupQuery.data;

  /**
   * One capture, used by both actions.
   *
   * `react-native-view-shot` throws when the native module is not linked into
   * the running binary, which is the normal state right after installing it —
   * so callers decide what to do without it rather than assuming it worked.
   */
  const captureCard = async () => {
    return captureRef(cardRef, { format: 'png', quality: 1 });
  };

  const handleShare = async () => {
    if (!result) {
      return;
    }

    setBusy('share');
    setShareError(null);

    try {
      const uri = await captureCard();

      await Share.share({ url: uri, message: buildAddressCardShareText(result) });
      hapticSuccess();
    } catch {
      // A failed capture must not lose the share — the text alone still tells
      // someone where the place is.
      try {
        await Share.share({ message: buildAddressCardShareText(result) });
      } catch {
        setShareError('Could not share the card.');
      }
    } finally {
      setBusy(null);
    }
  };

  /**
   * Saves the card to the photo library, which is what makes it printable and
   * keepable rather than only sendable. Asks for add-only permission — the app
   * never reads the library.
   */
  const handleSave = async () => {
    if (!result) {
      return;
    }

    setBusy('save');
    setShareError(null);

    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true);

      if (!permission.granted) {
        setShareError('Allow photo access to save the card, or use Share instead.');
        return;
      }

      const uri = await captureCard();
      await MediaLibrary.saveToLibraryAsync(uri);
      hapticSuccess();
      setSavedMessage('Saved to your photos.');
    } catch {
      setShareError('Could not save the card. You can still share it.');
    } finally {
      setBusy(null);
    }
  };

  if (!gpsCode) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackButton />

        <ErrorBanner message="No address code was given." />
      </Screen>
    );
  }

  if (lookupQuery.isPending) {
    return <LoadingState label="Building your card" />;
  }

  if (lookupQuery.error || !result) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackButton />

        <ErrorBanner message="Could not look up that address." />
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
        <BackButton />

      <AppText variant="body" tone="muted">
        A printable card with your code and a QR anyone can scan for directions.
      </AppText>

      <AddressCard ref={cardRef} result={result} />

      {shareError ? <ErrorBanner message={shareError} /> : null}

      {savedMessage ? (
        <AppText variant="caption" tone="primary">
          {savedMessage}
        </AppText>
      ) : null}

      <AppButton
        icon={<Share2 color={colors.onPrimary} size={18} />}
        onPress={() => void handleShare()}
        loading={busy === 'share'}
        disabled={busy !== null}
      >
        Share the card
      </AppButton>

      <AppButton
        variant="secondary"
        icon={<Download color={colors.text} size={18} />}
        onPress={() => void handleSave()}
        loading={busy === 'save'}
        disabled={busy !== null}
      >
        Save to photos
      </AppButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
});
