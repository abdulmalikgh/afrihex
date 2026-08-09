import { z } from 'zod';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';

import { changePassword } from '../../../api/auth';
import { AppButton, AppText, ErrorBanner, Screen } from '../../../components';
import { colors } from '../../../constants/colors';
import { spacing } from '../../../constants/spacing';
import { AuthPasswordInput } from '../../authentication/components/AuthPasswordInput';
import { useAuthSession } from '../../authentication/context/AuthSessionProvider';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z.string().min(8, 'Use at least 8 characters.'),
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export function ChangePasswordScreen() {
  const { logout, status } = useAuthSession();
  const { control, handleSubmit, setError, formState } = useForm<ChangePasswordFormValues>({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });
  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: async () => {
      await logout();
      router.replace('/auth/login');
    },
  });

  const submit = handleSubmit(async (values) => {
    const parsed = changePasswordSchema.safeParse(values);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];

        if (field === 'currentPassword' || field === 'newPassword' || field === 'confirmPassword') {
          setError(field, { message: issue.message });
        }
      }

      return;
    }

    await mutation.mutateAsync({
      current_password: parsed.data.currentPassword,
      new_password: parsed.data.newPassword,
    });
  });

  if (status === 'anonymous') {
    return (
      <Screen scroll contentStyle={styles.content}>
        <View style={styles.header}>
          <AppText variant="title">Sign in required</AppText>
          <AppText variant="body" tone="muted">
            Sign in before changing your account password.
          </AppText>
        </View>
        <AppButton onPress={() => router.replace('/auth/login')}>Sign in</AppButton>
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={10}
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <ArrowLeft color={colors.text} size={24} />
      </Pressable>

      <View style={styles.header}>
        <AppText variant="title">Change password</AppText>
        <AppText variant="body" tone="muted">
          Update the password used to sign in to your AfriHex account.
        </AppText>
      </View>

      {mutation.error ? <ErrorBanner message={getErrorMessage(mutation.error)} /> : null}

      <View style={styles.field}>
        <AppText variant="caption" tone="muted">
          Current password
        </AppText>
        <Controller
          control={control}
          name="currentPassword"
          render={({ field: { onBlur, onChange, value } }) => (
            <AuthPasswordInput
              accessibilityLabel="Current password"
              autoCapitalize="none"
              autoComplete="current-password"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Current password"
              value={value}
            />
          )}
        />
        {formState.errors.currentPassword?.message ? (
          <AppText variant="caption" tone="danger">
            {formState.errors.currentPassword.message}
          </AppText>
        ) : null}
      </View>

      <View style={styles.field}>
        <AppText variant="caption" tone="muted">
          New password
        </AppText>
        <Controller
          control={control}
          name="newPassword"
          render={({ field: { onBlur, onChange, value } }) => (
            <AuthPasswordInput
              accessibilityLabel="New password"
              autoCapitalize="none"
              autoComplete="new-password"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="At least 8 characters"
              textContentType="newPassword"
              value={value}
            />
          )}
        />
        {formState.errors.newPassword?.message ? (
          <AppText variant="caption" tone="danger">
            {formState.errors.newPassword.message}
          </AppText>
        ) : null}
      </View>

      <View style={styles.field}>
        <AppText variant="caption" tone="muted">
          Confirm password
        </AppText>
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onBlur, onChange, value } }) => (
            <AuthPasswordInput
              accessibilityLabel="Confirm new password"
              autoCapitalize="none"
              autoComplete="new-password"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Repeat new password"
              textContentType="newPassword"
              value={value}
            />
          )}
        />
        {formState.errors.confirmPassword?.message ? (
          <AppText variant="caption" tone="danger">
            {formState.errors.confirmPassword.message}
          </AppText>
        ) : null}
      </View>

      <AppButton loading={mutation.isPending} onPress={submit}>
        Change password
      </AppButton>
    </Screen>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  field: {
    gap: spacing.sm,
  },
});
