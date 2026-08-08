import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { colors } from '../constants/colors';
import { radius } from '../constants/radius';
import { spacing } from '../constants/spacing';
import { fontFamilies, fontSizes } from '../constants/typography';

export function AppInput(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.faint}
      selectionColor={colors.primaryLight}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBg,
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.base,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
