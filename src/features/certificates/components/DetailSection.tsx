import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../components';
import { colors } from '../../../constants/colors';
import { radius } from '../../../constants/radius';
import { spacing } from '../../../constants/spacing';

type DetailSectionProps = {
  title: string;
  icon: ReactNode;
  children: ReactNode;
};

/**
 * One titled block of the certificate. Sections sit as siblings rather than
 * nesting, so the screen stays a flat stack of cards.
 */
export function DetailSection({ title, icon, children }: DetailSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        {icon}
        <AppText variant="overline" tone="muted">
          {title}
        </AppText>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

type DetailRowProps = {
  label: string;
  value: string;
  mono?: boolean;
  tone?: 'default' | 'danger' | 'primary';
};

/**
 * Renders nothing when the value is absent. Most certificate fields are
 * `omitempty`, and an empty row reads as missing data rather than as a field
 * the server simply did not send.
 */
export function DetailRow({ label, value, mono = false, tone = 'default' }: DetailRowProps) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" tone="muted" style={styles.label}>
        {label}
      </AppText>
      <AppText variant={mono ? 'code' : 'caption'} tone={tone} align="right" style={styles.value}>
        {value}
      </AppText>
    </View>
  );
}

/**
 * The same row, skipped entirely when the server sent nothing. Most certificate
 * fields are `omitempty`, and a blank value reads as missing data rather than as
 * a field that simply does not apply.
 */
export function OptionalRow({
  value,
  ...props
}: Omit<DetailRowProps, 'value'> & { value: string | undefined }) {
  return value ? <DetailRow {...props} value={value} /> : null;
}

const styles = StyleSheet.create({
  section: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  body: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  label: {
    flexShrink: 0,
  },
  value: {
    flex: 1,
  },
});
