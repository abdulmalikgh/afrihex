import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronDown, ChevronUp, Copy, ExternalLink, Navigation, Share2 } from 'lucide-react-native';

import { AppText } from '../../../components';
import { mapColors, mapShape } from '../../../constants/material';
import { spacing } from '../../../constants/spacing';
import { formatCoordinate, getPlaceSubtitle, getPlaceTitle, isLowQuality } from '../utils/searchFormatting';
import { MapActionCircle } from './MapActions';
import { MapDivider } from './MapListRow';
import type { ResolvedFindGpsResult } from '../hooks/useFindGpsSearch';

type AddressResultCardProps = {
  result: ResolvedFindGpsResult;
  onOpenMaps: (result: ResolvedFindGpsResult) => void;
  onOpenDirections: (result: ResolvedFindGpsResult) => void;
  onCopy: (result: ResolvedFindGpsResult) => void;
  onShare: (result: ResolvedFindGpsResult) => void;
};

/**
 * The resolved place. Ordered by what the user came for: the code first, since it
 * is the thing this app exists to produce and the thing they copy or read aloud;
 * then the actions; then the place's name and context.
 *
 * Region, district and area are deliberately not listed as rows. They are already
 * the subtitle, and printing them twice — once joined into a line, once as a
 * label/value table — was the bulk of the old card without adding anything.
 */
export function AddressResultCard({
  result,
  onOpenMaps,
  onOpenDirections,
  onCopy,
  onShare,
}: AddressResultCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const approximate = isLowQuality(result.qualityScore);
  const title = getPlaceTitle(result);
  const subtitle = getPlaceSubtitle(result);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Copy address code ${result.gpsCode}`}
        accessibilityHint="Copies the code to the clipboard"
        onPress={() => onCopy(result)}
        style={({ pressed }) => [styles.codeCard, pressed && styles.pressed]}
      >
        <View style={styles.codeTextGroup}>
          <AppText variant="overline" style={styles.codeLabel}>
            AfriHex code
          </AppText>
          <AppText variant="codeHero" numberOfLines={1} adjustsFontSizeToFit style={styles.codeValue}>
            {result.gpsCode}
          </AppText>
        </View>

        <View style={styles.codeCopy}>
          <Copy color={mapColors.onPrimaryContainer} size={20} />
        </View>
      </Pressable>

      {approximate ? (
        <AppText variant="caption" style={styles.approximate}>
          Approximate location — the code covers a wider area than usual
        </AppText>
      ) : null}

      <View style={styles.actions}>
        <MapActionCircle label="Directions" icon={Navigation} variant="filled" onPress={() => onOpenDirections(result)} />
        <MapActionCircle label="Copy" icon={Copy} onPress={() => onCopy(result)} />
        <MapActionCircle label="Share" icon={Share2} onPress={() => onShare(result)} />
        <MapActionCircle
          label="Maps"
          icon={ExternalLink}
          disabled={!result.googleMapsUrl}
          onPress={() => onOpenMaps(result)}
        />
      </View>

      <MapDivider inset={false} />

      <View style={styles.place}>
        <AppText variant="bodyStrong" numberOfLines={2} style={styles.placeTitle}>
          {title}
        </AppText>

        {subtitle ? (
          <AppText variant="caption" numberOfLines={2} style={styles.placeSubtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {detailsOpen ? (
        <View style={styles.details}>
          <DetailRow label="Postcode" value={result.postcode ?? 'Unknown'} />
          <DetailRow
            label="Coordinates"
            value={`${formatCoordinate(result.latitude)}, ${formatCoordinate(result.longitude)}`}
            selectable
          />
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: detailsOpen }}
        onPress={() => setDetailsOpen((open) => !open)}
        style={({ pressed }) => [styles.detailsToggle, pressed && styles.pressed]}
      >
        <AppText variant="caption" style={styles.detailsToggleLabel}>
          {detailsOpen ? 'Fewer details' : 'More details'}
        </AppText>
        {detailsOpen ? (
          <ChevronUp color={mapColors.primary} size={16} />
        ) : (
          <ChevronDown color={mapColors.primary} size={16} />
        )}
      </Pressable>
    </View>
  );
}

function DetailRow({ label, value, selectable = false }: { label: string; value: string; selectable?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <AppText variant="caption" style={styles.detailLabel}>
        {label}
      </AppText>
      <AppText variant="body" numberOfLines={2} selectable={selectable} style={styles.detailValue}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    borderRadius: mapShape.large,
    backgroundColor: mapColors.primaryContainer,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  codeTextGroup: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  codeLabel: {
    color: mapColors.onPrimaryContainer,
    opacity: 0.7,
  },
  codeValue: {
    color: mapColors.onPrimaryContainer,
  },
  codeCopy: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  approximate: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
    color: mapColors.warning,
  },
  pressed: {
    opacity: 0.8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  place: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  placeTitle: {
    color: mapColors.onSurface,
  },
  placeSubtitle: {
    color: mapColors.onSurfaceVariant,
  },
  details: {
    paddingTop: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    width: 96,
    color: mapColors.onSurfaceVariant,
  },
  detailValue: {
    flex: 1,
    minWidth: 0,
    color: mapColors.onSurface,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    minHeight: 40,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: mapShape.full,
    paddingHorizontal: spacing.sm,
  },
  detailsToggleLabel: {
    color: mapColors.primary,
  },
});
