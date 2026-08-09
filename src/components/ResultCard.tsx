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
  icon?: ReactNode;
  children?: ReactNode;
};

export function ResultCard({ title, description, meta, icon, children }: ResultCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <AppText variant="bodyStrong" numberOfLines={2} style={styles.title}>
          {title}
        </AppText>
      </View>
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
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
  },
  icon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    flexShrink: 1,
    marginTop: spacing.xs,
  },
  meta: {
    flexShrink: 1,
    marginTop: spacing.sm,
  },
  children: {
    marginTop: spacing.md,
  },
});
