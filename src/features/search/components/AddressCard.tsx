import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppText } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';
import { uniqueLocalityParts, type ResolvedFindGpsResult } from '../../../utils/resolveAddressQuery';

/**
 * The QR encodes a directions link rather than a deep link, so it works for
 * whoever scans it — app installed or not. Matches what the web card uses.
 */
export function buildAddressCardQrValue(result: ResolvedFindGpsResult) {
  return `https://maps.afrihex.com/directions?to=${result.latitude},${result.longitude}`;
}

/** The text that travels with the card image through a share sheet. */
export function buildAddressCardShareText(result: ResolvedFindGpsResult) {
  const lines = [`My AfriHex Address: ${result.gpsCode}`];

  if (result.region) {
    lines.push(`Region: ${result.region}`);
  }

  if (result.district) {
    lines.push(`District: ${result.district}`);
  }

  if (result.area) {
    lines.push(`Area: ${result.area}`);
  }

  lines.push('', `Navigate: ${buildAddressCardQrValue(result)}`);

  return lines.join('\n');
}

/**
 * The printable address card.
 *
 * There is no server endpoint that renders this — the whole card is local UI,
 * captured to an image by the screen that owns it. That is why it takes a ref:
 * the capture library needs the mounted view, not a description of it.
 */
export const AddressCard = forwardRef<View, { result: ResolvedFindGpsResult }>(function AddressCard(
  { result },
  ref,
) {
  const locality = uniqueLocalityParts([result.area, result.district, result.region]).join(' · ');

  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={styles.header}>
        <AppText variant="overline" style={styles.brand}>
          AfriHex address
        </AppText>
        <AppText variant="codeHero" numberOfLines={1} adjustsFontSizeToFit style={styles.code}>
          {result.gpsCode}
        </AppText>
      </View>

      <View style={styles.body}>
        <View style={styles.details}>
          {locality ? (
            <AppText variant="body" style={styles.locality}>
              {locality}
            </AppText>
          ) : null}

          {result.postcode ? (
            <Row label="Postcode" value={result.postcode} />
          ) : null}

          <Row
            label="Coordinates"
            value={`${result.latitude.toFixed(5)}, ${result.longitude.toFixed(5)}`}
          />
        </View>

        {/* White plate behind the QR: scanners need the light quiet zone, and the
            card itself sits on the dark brand surface. */}
        <View style={styles.qrPlate}>
          <QRCode value={buildAddressCardQrValue(result)} size={104} backgroundColor="#ffffff" />
        </View>
      </View>

      <AppText variant="caption" style={styles.footer}>
        Scan for directions
      </AppText>
    </View>
  );
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" style={styles.rowLabel}>
        {label}
      </AppText>
      <AppText variant="caption" numberOfLines={1} style={styles.rowValue}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    padding: spacing.xl,
  },
  header: {
    gap: spacing.xs,
  },
  brand: {
    color: colors.primaryLight,
  },
  code: {
    color: colors.text,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  details: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  locality: {
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowLabel: {
    width: 88,
    color: colors.muted,
  },
  rowValue: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
  },
  qrPlate: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  footer: {
    color: colors.faint,
  },
});
