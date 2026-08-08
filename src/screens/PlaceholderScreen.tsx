import { StyleSheet, View } from 'react-native';

import { AppButton, AppText, CodeChip, ResultCard, Screen } from '../components';
import { spacing } from '../constants/spacing';

type PlaceholderScreenProps = {
  title: string;
  description: string;
  eyebrow: string;
  code?: string;
  primaryAction?: string;
};

export function PlaceholderScreen({
  title,
  description,
  eyebrow,
  code,
  primaryAction,
}: PlaceholderScreenProps) {
  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="caption" tone="primary">
          {eyebrow}
        </AppText>
        <AppText variant="title">{title}</AppText>
        <AppText variant="body" tone="muted">
          {description}
        </AppText>
      </View>

      <ResultCard title="App shell ready" description="This screen is wired into Expo Router and ready for feature implementation.">
        {code ? <CodeChip value={code} /> : null}
      </ResultCard>

      {primaryAction ? <AppButton>{primaryAction}</AppButton> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
});
