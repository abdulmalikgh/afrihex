import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '../constants/colors';
import { radius } from '../constants/radius';
import { spacing } from '../constants/spacing';

type BottomSheetProps = {
  children: ReactNode;
};

export function BottomSheet({ children }: BottomSheetProps) {
  return (
    <View style={styles.container}>
      <View style={styles.handle} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.round,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.lg,
  },
});
