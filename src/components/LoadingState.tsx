import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '../constants/colors';
import { spacing } from '../constants/spacing';
import { AppText } from './AppText';

type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = 'Loading' }: LoadingStateProps) {
  return (
    <View style={styles.container} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.primaryLight} />
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
});
