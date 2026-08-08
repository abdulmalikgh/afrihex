import { StyleSheet, View } from 'react-native';

import { spacing } from '../constants/spacing';
import { AppText } from './AppText';

type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <AppText variant="subtitle" align="center">
        {title}
      </AppText>
      {description ? (
        <AppText variant="caption" tone="muted" align="center" style={styles.description}>
          {description}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  description: {
    maxWidth: 320,
  },
});
