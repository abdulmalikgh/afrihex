import type { ReactNode } from 'react';
import { StyleSheet, View, type TextInputProps, type ViewStyle } from 'react-native';

import { colors } from '../constants/colors';
import { radius } from '../constants/radius';
import { spacing } from '../constants/spacing';
import { AppInput } from './AppInput';

type SearchBarProps = TextInputProps & {
  containerStyle?: ViewStyle;
  leadingAccessory?: ReactNode;
  trailingAccessory?: ReactNode;
};

export function SearchBar({ containerStyle, leadingAccessory, trailingAccessory, ...props }: SearchBarProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {leadingAccessory ? <View style={styles.leadingAccessory}>{leadingAccessory}</View> : null}
      <AppInput {...props} style={[styles.input, props.style]} />
      {trailingAccessory ? <View style={styles.trailingAccessory}>{trailingAccessory}</View> : null}
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
    minWidth: 0,
    minHeight: 50,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.md,
  },
  leadingAccessory: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: spacing.md,
  },
  trailingAccessory: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: spacing.xs,
  },
});
