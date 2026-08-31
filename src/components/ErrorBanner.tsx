import { TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors } from '../constants/colors';
import { radius } from '../constants/radius';
import { spacing } from '../constants/spacing';
import { AppText } from './AppText';

type ErrorBannerProps = {
  message: string;
};

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    // `alert` alone is not announced on Android — the live region is what makes
    // an error that appears after a tap reach a screen-reader user at all.
    <View style={styles.container} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <TriangleAlert color={colors.danger} size={18} />
      <AppText variant="caption" tone="danger" style={styles.message}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.card,
    padding: spacing.md,
  },
  message: {
    flex: 1,
  },
});
