import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
} from 'react-native';

import { colors } from '../constants/colors';
import { radius } from '../constants/radius';
import { spacing } from '../constants/spacing';
import { AppText } from './AppText';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type AppButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  children: ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
};

export function AppButton({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityRole = 'button',
  ...props
}: AppButtonProps) {
  return (
    <Pressable
      {...props}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? colors.white : colors.text} />
      ) : (
        <AppText variant="bodyStrong" tone={variant === 'primary' || variant === 'danger' ? 'default' : 'primary'}>
          {children}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.5,
  },
});

const variantStyles = StyleSheet.create<Record<ButtonVariant, object>>({
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.cardAlt,
    borderColor: colors.borderStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
});
