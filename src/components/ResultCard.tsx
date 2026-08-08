import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '../constants/colors';
import { radius } from '../constants/radius';
import { spacing } from '../constants/spacing';
import { AppText } from './AppText';

type ResultCardProps = {
  title: string;
  description?: string;
  meta?: string;
  children?: ReactNode;
};

export function ResultCard({ title, description, meta, children }: ResultCardProps) {
  return (
    <View style={styles.card}>
      <AppText variant="bodyStrong">{title}</AppText>
      {description ? (
        <AppText variant="caption" tone="muted" style={styles.description}>
          {description}
        </AppText>
      ) : null}
      {meta ? (
        <AppText variant="caption" tone="faint" style={styles.meta}>
          {meta}
        </AppText>
      ) : null}
      {children ? <View style={styles.children}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
  },
  description: {
    marginTop: spacing.xs,
  },
  meta: {
    marginTop: spacing.sm,
  },
  children: {
    marginTop: spacing.md,
  },
});
