import { useEffect } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { CloudDownload, HardDrive, Trash2, TriangleAlert } from 'lucide-react-native';

import { AppButton, AppText, BackButton, ErrorBanner, Screen } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { useOfflineBasemap } from '../hooks/useOfflineBasemap';

/** Roughly what the archive weighs. Treated as approximate, as the doc says. */
const APPROX_SIZE_LABEL = '~230 MB';

export function OfflineMapsScreen() {
  const offline = useOfflineBasemap();
  const { checkForUpdate, state } = offline;

  // Opportunistic, as the doc asks — once when the screen opens, never polled.
  useEffect(() => {
    if (state.status === 'ready') {
      void checkForUpdate();
    }
  }, [checkForUpdate, state.status]);

  const isDownloading = offline.progress !== null;
  const percent = offline.progress !== null ? Math.round(offline.progress * 100) : null;

  const confirmRemove = () => {
    Alert.alert('Delete the offline map?', `You would need to download ${APPROX_SIZE_LABEL} again to get it back.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void offline.remove() },
    ]);
  };

  return (
    <Screen scroll contentStyle={styles.content}>
        <BackButton />

      <AppText variant="body" tone="muted">
        Download Ghana&apos;s streets, buildings and places once, and keep them on this phone for when
        there is no signal.
      </AppText>

      {offline.errorMessage ? <ErrorBanner message={offline.errorMessage} /> : null}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <HardDrive color={colors.primaryLight} size={22} />
          <View style={styles.cardText}>
            <AppText variant="bodyStrong">Ghana basemap</AppText>
            <AppText variant="caption" tone="muted">
              {describeState(offline.state.status, offline.state.sizeBytes)}
            </AppText>
          </View>
        </View>

        {isDownloading ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: percent === null ? '100%' : `${percent}%` }]} />
            </View>
            <AppText variant="caption" tone="muted">
              {percent === null ? 'Downloading…' : `${percent}% of ${APPROX_SIZE_LABEL}`}
            </AppText>
            <AppButton variant="ghost" onPress={offline.cancel}>
              Cancel
            </AppButton>
          </View>
        ) : (
          <>
            {offline.state.status === 'ready' && offline.state.updateAvailable ? (
              <View style={styles.updateRow}>
                <TriangleAlert color={colors.gold} size={16} />
                <AppText variant="caption" tone="gold" style={styles.updateText}>
                  A newer map is available. Updating costs the same {APPROX_SIZE_LABEL} again.
                </AppText>
              </View>
            ) : null}

            <AppButton
              icon={<CloudDownload color={colors.onPrimary} size={18} />}
              onPress={() => void offline.download()}
            >
              {offline.state.status === 'ready' ? 'Download again' : `Download ${APPROX_SIZE_LABEL}`}
            </AppButton>

            {/* Wi-Fi guidance rather than a hard block: the doc asks for this to
                be an explicit user action, not an automatic first-launch cost. */}
            <AppText variant="caption" tone="faint">
              Best done on Wi-Fi. This is a large download.
            </AppText>

            {offline.state.status === 'ready' ? (
              <AppButton
                variant="ghost"
                icon={<Trash2 color={colors.danger} size={18} />}
                onPress={confirmRemove}
              >
                Delete the offline map
              </AppButton>
            ) : null}
          </>
        )}
      </View>

      {/* Stated plainly rather than left for someone to discover: the archive
          downloads and validates, but nothing renders it yet. */}
      <View style={styles.noteCard}>
        <AppText variant="caption" tone="muted">
          The map you see in the app still comes from the network for now. The downloaded archive is
          stored and verified, but drawing it offline needs a tile renderer the app does not have yet.
        </AppText>
      </View>
    </Screen>
  );
}

function describeState(status: string, sizeBytes?: number) {
  switch (status) {
    case 'ready':
      return sizeBytes ? `Saved · ${(sizeBytes / 1_048_576).toFixed(0)} MB on this phone` : 'Saved on this phone';
    case 'invalid':
      return 'The saved copy is damaged. Download it again.';
    case 'absent':
      return 'Not downloaded';
    default:
      return 'Checking…';
  }
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  card: {
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  progressBlock: {
    gap: spacing.sm,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.round,
    backgroundColor: colors.cardAlt,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.round,
    backgroundColor: colors.primary,
  },
  updateRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  updateText: {
    flex: 1,
    minWidth: 0,
  },
  noteCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    padding: spacing.md,
  },
});
