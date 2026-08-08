import { Search } from 'lucide-react-native';
import { StyleSheet, View, type TextInputProps } from 'react-native';

import { colors } from '../constants/colors';
import { radius } from '../constants/radius';
import { spacing } from '../constants/spacing';
import { AppInput } from './AppInput';

export function SearchBar(props: TextInputProps) {
  return (
    <View style={styles.container}>
      <Search color={colors.muted} size={20} strokeWidth={2.2} />
      <AppInput {...props} style={[styles.input, props.style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    paddingLeft: spacing.lg,
  },
  input: {
    flex: 1,
    minHeight: 50,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingLeft: 0,
  },
});
