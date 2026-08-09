import { StyleSheet, View, type TextInputProps, type ViewStyle } from 'react-native';

import { colors } from '../constants/colors';
import { radius } from '../constants/radius';
import { spacing } from '../constants/spacing';
import { AppInput } from './AppInput';

type SearchBarProps = TextInputProps & {
  containerStyle?: ViewStyle;
};

export function SearchBar({ containerStyle, ...props }: SearchBarProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      <AppInput {...props} style={[styles.input, props.style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    minHeight: 50,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.md,
  },
});
