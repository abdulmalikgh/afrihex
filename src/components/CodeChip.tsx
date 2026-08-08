import { StyleSheet, View } from 'react-native';

import { colors } from '../constants/colors';
import { radius } from '../constants/radius';
import { spacing } from '../constants/spacing';
import { AppText } from './AppText';

type CodeChipProps = {
  value: string;
};

export function CodeChip({ value }: CodeChipProps) {
  return (
    <View style={styles.container}>
      <AppText variant="code" tone="primary">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
