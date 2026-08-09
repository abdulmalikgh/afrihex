import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../components';
import { colors } from '../../../constants/colors';
import { spacing } from '../../../constants/spacing';

export function AuthDivider() {
  return (
    <View style={styles.container} accessibilityElementsHidden importantForAccessibility="no">
      <View style={styles.line} />
      <AppText variant="caption" tone="faint">
        or
      </AppText>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
});
