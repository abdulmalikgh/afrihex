import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type TextInputProps } from 'react-native';

import { AppInput } from '../../../components';
import { colors } from '../../../constants/colors';
import { spacing } from '../../../constants/spacing';

type AuthPasswordInputProps = Omit<TextInputProps, 'secureTextEntry'>;

export function AuthPasswordInput(props: AuthPasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <View style={styles.container}>
      <AppInput
        {...props}
        secureTextEntry={!visible}
        style={[styles.input, props.style]}
        textContentType={props.textContentType ?? 'password'}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        accessibilityState={{ checked: visible }}
        hitSlop={8}
        onPress={() => {
          setVisible((current) => !current);
        }}
        style={styles.toggle}
      >
        <Icon color={colors.muted} size={20} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  input: {
    paddingRight: spacing.xl + spacing.lg,
  },
  toggle: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
